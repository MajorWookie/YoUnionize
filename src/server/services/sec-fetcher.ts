import { eq, sql } from 'drizzle-orm'
import { getDb, rawSecResponses, companies } from '@younionize/postgres'
import { getActualSectionItems, getSectionItemsForFilingType } from '@younionize/sec-api'
import type { Filing, SectionItemInfo } from '@younionize/sec-api'
import { pMapSettled } from '@younionize/helpers'
import { getSecApiClient } from '../sec-api-client'
import type { CompanyRecord } from './company-lookup'

interface FetchResult {
  endpoints: {
    filings: { status: 'complete' | 'error'; count: number; error?: string }
    compensation: { status: 'complete' | 'error'; error?: string }
    insiderTrading: { status: 'complete' | 'error'; count: number; error?: string }
    directors: { status: 'complete' | 'error'; error?: string }
    form8k: { status: 'complete' | 'error'; error?: string }
    xbrl: { succeeded: number; failed: number }
    sections: { succeeded: number; failed: number }
  }
}

/**
 * Phase 1: Fetch ALL SEC API data for a company and store verbatim responses
 * in raw_sec_responses. No transformation, no LLM calls — pure data collection.
 *
 * Each API call is independent; failures in one endpoint don't block others.
 * Uses upsert on (company_id, endpoint, sub_key) for idempotency.
 */
export async function fetchAllSecData(company: CompanyRecord): Promise<FetchResult> {
  const client = getSecApiClient()
  const db = getDb()

  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0]

  const result: FetchResult = {
    endpoints: {
      filings: { status: 'complete', count: 0 },
      compensation: { status: 'complete' },
      insiderTrading: { status: 'complete', count: 0 },
      directors: { status: 'complete' },
      form8k: { status: 'complete' },
      xbrl: { succeeded: 0, failed: 0 },
      sections: { succeeded: 0, failed: 0 },
    },
  }

  // Fetch top-level data in parallel (independent endpoints)
  const [filingsResult, compResult, insiderResult, directorsResult, form8kResult] =
    await Promise.allSettled([
      fetchFilings(client, company, oneYearAgoStr),
      fetchCompensation(client, company),
      fetchInsiderTrading(client, company, oneYearAgoStr),
      fetchDirectors(client, company),
      fetchForm8K(client, company, oneYearAgoStr),
    ])

  // Store filing search responses
  let allFilings: Array<Filing> = []
  if (filingsResult.status === 'fulfilled') {
    const { filings, responses } = filingsResult.value
    allFilings = filings
    for (const { subKey, response } of responses) {
      await upsertRawResponse(db, company.id, 'filings', subKey, response)
    }
    result.endpoints.filings.count = filings.length
  } else {
    result.endpoints.filings = { status: 'error', count: 0, error: errorMessage(filingsResult.reason) }
    await upsertRawResponse(db, company.id, 'filings', null, null, errorMessage(filingsResult.reason))
  }

  // Store compensation response
  if (compResult.status === 'fulfilled') {
    await upsertRawResponse(db, company.id, 'compensation', null, compResult.value)
  } else {
    result.endpoints.compensation = { status: 'error', error: errorMessage(compResult.reason) }
    await upsertRawResponse(db, company.id, 'compensation', null, null, errorMessage(compResult.reason))
  }

  // Store insider trading response
  if (insiderResult.status === 'fulfilled') {
    await upsertRawResponse(db, company.id, 'insider_trading', null, insiderResult.value.raw)
    result.endpoints.insiderTrading.count = insiderResult.value.transactionCount
  } else {
    result.endpoints.insiderTrading = { status: 'error', count: 0, error: errorMessage(insiderResult.reason) }
    await upsertRawResponse(db, company.id, 'insider_trading', null, null, errorMessage(insiderResult.reason))
  }

  // Store directors response
  if (directorsResult.status === 'fulfilled') {
    await upsertRawResponse(db, company.id, 'directors', null, directorsResult.value)
  } else {
    result.endpoints.directors = { status: 'error', error: errorMessage(directorsResult.reason) }
    await upsertRawResponse(db, company.id, 'directors', null, null, errorMessage(directorsResult.reason))
  }

  // Store form 8-K response
  if (form8kResult.status === 'fulfilled') {
    await upsertRawResponse(db, company.id, 'form_8k', null, form8kResult.value)
  } else {
    result.endpoints.form8k = { status: 'error', error: errorMessage(form8kResult.reason) }
    await upsertRawResponse(db, company.id, 'form_8k', null, null, errorMessage(form8kResult.reason))
  }

  // Fetch per-filing enrichments (XBRL + sections).
  // XBRL is only meaningful for 10-K/10-Q (financial filings). Section
  // extraction runs for every supported filing type — 10-K, 10-Q, 8-K, DEF 14A.
  const xbrlFilings = allFilings.filter(
    (f) => (f.formType === '10-K' || f.formType === '10-Q') && f.linkToFilingDetails,
  )

  for (const filing of xbrlFilings) {
    try {
      const xbrl = await client.xbrlToJson({ htmUrl: filing.linkToFilingDetails! })
      await upsertRawResponse(db, company.id, 'xbrl', filing.accessionNo, xbrl)
      result.endpoints.xbrl.succeeded++
    } catch {
      console.info(`[SecFetcher] XBRL failed for ${filing.accessionNo}`)
      await upsertRawResponse(db, company.id, 'xbrl', filing.accessionNo, null, 'XBRL extraction failed')
      result.endpoints.xbrl.failed++
    }
  }

  const sectionFilings = allFilings.filter(
    (f) => f.linkToFilingDetails && getSectionItemsForFilingType(f.formType).length > 0,
  )

  for (const filing of sectionFilings) {
    // For 8-K, narrow to items actually in the filing — see
    // getActualSectionItems for why (avoids 60s+ of dead polling per
    // non-existent item).
    const rawItems = (filing as unknown as { items?: ReadonlyArray<string> }).items
    const sectionItems = getActualSectionItems(filing.formType, rawItems)
    // Cap concurrent extractor calls per filing — see SECTION_EXTRACT_CONCURRENCY
    // in scripts/seed-companies.ts for the rationale (sec-api's async
    // extractor queue floods when 17-21 sections fire simultaneously).
    const sectionResults = await pMapSettled(
      sectionItems,
      async (item: SectionItemInfo) => {
        const text = await client.extractSection(filing.linkToFilingDetails!, item.code)
        return { item, text }
      },
      4,
    )

    // Iterate by index so each rejection retains its `item` context — the prior
    // implementation lost section identity on failure and recorded the subKey
    // as 'unknown', making errors un-debuggable.
    for (let i = 0; i < sectionResults.length; i++) {
      const item = sectionItems[i]
      const sectionResult = sectionResults[i]
      const subKey = `${filing.accessionNo}:${item.code}`

      if (sectionResult.status === 'fulfilled' && sectionResult.value.text) {
        await upsertRawResponse(db, company.id, 'sections', subKey, { text: sectionResult.value.text })
        result.endpoints.sections.succeeded++
      } else if (sectionResult.status === 'fulfilled') {
        // Empty extraction — record an explicit empty row so processSections
        // can mark fetch_status='empty' downstream.
        await upsertRawResponse(db, company.id, 'sections', subKey, { text: '' })
        result.endpoints.sections.succeeded++
      } else {
        const errMsg = errorMessage(sectionResult.reason)
        console.info(`[SecFetcher] Section ${item.name} (${item.code}) failed for ${filing.accessionNo}: ${errMsg}`)
        await upsertRawResponse(db, company.id, 'sections', subKey, null, errMsg)
        result.endpoints.sections.failed++
      }
    }
  }

  // Update company.last_fetch_at
  await db
    .update(companies)
    .set({ lastFetchAt: new Date().toISOString() })
    .where(eq(companies.id, company.id))

  return result
}

// ─── Helper: Fetch filing searches ─────────────────────────────────────

async function fetchFilings(
  client: ReturnType<typeof getSecApiClient>,
  company: CompanyRecord,
  oneYearAgoStr: string,
) {
  const [tenK, tenQ, eightK, def14a] = await Promise.all([
    client.searchFilings({
      query: `ticker:${company.ticker} AND formType:"10-K"`,
      from: '0',
      size: '1',
      sort: [{ filedAt: { order: 'desc' } }],
    }),
    client.searchFilings({
      query: `ticker:${company.ticker} AND formType:"10-Q"`,
      from: '0',
      size: '4',
      sort: [{ filedAt: { order: 'desc' } }],
    }),
    client.searchFilings({
      query: `ticker:${company.ticker} AND formType:"8-K" AND filedAt:[${oneYearAgoStr} TO *]`,
      from: '0',
      size: '50',
      sort: [{ filedAt: { order: 'desc' } }],
    }),
    client.searchFilings({
      query: `ticker:${company.ticker} AND formType:"DEF 14A"`,
      from: '0',
      size: '1',
      sort: [{ filedAt: { order: 'desc' } }],
    }),
  ])

  const filings = [
    ...tenK.filings,
    ...tenQ.filings,
    ...eightK.filings,
    ...def14a.filings,
  ]

  return {
    filings,
    responses: [
      { subKey: '10-K', response: tenK },
      { subKey: '10-Q', response: tenQ },
      { subKey: '8-K', response: eightK },
      { subKey: 'DEF-14A', response: def14a },
    ],
  }
}

async function fetchCompensation(
  client: ReturnType<typeof getSecApiClient>,
  company: CompanyRecord,
) {
  return client.getCompensationByTicker(company.ticker)
}

async function fetchInsiderTrading(
  client: ReturnType<typeof getSecApiClient>,
  company: CompanyRecord,
  oneYearAgoStr: string,
) {
  const allTransactions: Array<unknown> = []
  for await (const page of client.paginateInsiderTrading({
    query: `issuer.tradingSymbol:${company.ticker} AND filedAt:[${oneYearAgoStr} TO *]`,
    sort: [{ filedAt: { order: 'desc' } }],
  })) {
    allTransactions.push(...page.transactions)
  }
  return { raw: { transactions: allTransactions }, transactionCount: allTransactions.length }
}

async function fetchDirectors(
  client: ReturnType<typeof getSecApiClient>,
  company: CompanyRecord,
) {
  return client.searchDirectors({
    query: `ticker:${company.ticker}`,
    from: '0',
    size: '1',
    sort: [{ filedAt: { order: 'desc' } }],
  })
}

async function fetchForm8K(
  client: ReturnType<typeof getSecApiClient>,
  company: CompanyRecord,
  oneYearAgoStr: string,
) {
  return client.searchForm8K({
    query: `ticker:${company.ticker} AND filedAt:[${oneYearAgoStr} TO *]`,
    from: '0',
    size: '50',
    sort: [{ filedAt: { order: 'desc' } }],
  })
}

// ─── Helper: Upsert raw response ──────────────────────────────────────

async function upsertRawResponse(
  db: ReturnType<typeof getDb>,
  companyId: string,
  endpoint: string,
  subKey: string | null,
  response: unknown,
  error?: string,
): Promise<void> {
  const fetchStatus = error ? 'error' : 'complete'
  const rawResponse = response ?? {}

  await db
    .insert(rawSecResponses)
    .values({
      companyId,
      endpoint,
      subKey,
      rawResponse,
      fetchStatus,
      fetchError: error ?? null,
      processStatus: 'pending',
    })
    .onConflictDoUpdate({
      target: [rawSecResponses.companyId, rawSecResponses.endpoint],
      targetWhere: sql`COALESCE(${rawSecResponses.subKey}, '') = COALESCE(${subKey ?? null}, '')`,
      set: {
        rawResponse,
        fetchStatus,
        fetchError: error ?? null,
        processStatus: 'pending',
        processedAt: null,
        createdAt: new Date().toISOString(),
      },
    })
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
