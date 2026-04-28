import { eq } from 'drizzle-orm'
import { getDb, filingSummaries } from '@younionize/postgres'
import { TenKSection } from '@younionize/sec-api'
import type { Filing, FilingQueryResponse } from '@younionize/sec-api'
import { getSecApiClient } from '../sec-api-client'
import type { CompanyRecord } from './company-lookup'

interface FilingIngestionResult {
  ingested: number
  skipped: number
  errors: Array<string>
}

/**
 * Ingest filings for a company: latest 10-K, latest 4 10-Qs, 8-Ks from past year, latest DEF 14A.
 * For each filing, stores raw data, XBRL structured data, and extracted sections.
 * Idempotent: skips filings already stored (by accession_number).
 */
export async function ingestFilings(company: CompanyRecord): Promise<FilingIngestionResult> {
  const client = getSecApiClient()
  const result: FilingIngestionResult = { ingested: 0, skipped: 0, errors: [] }

  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0]

  // Fetch all filing types in parallel
  const [tenKResult, tenQResult, eightKResult, defResult] = await Promise.all([
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

  const allFilings: Array<{ filing: Filing; filingType: string }> = [
    ...tenKResult.filings.map((f) => ({ filing: f, filingType: '10-K' })),
    ...tenQResult.filings.map((f) => ({ filing: f, filingType: '10-Q' })),
    ...eightKResult.filings.map((f) => ({ filing: f, filingType: '8-K' })),
    ...defResult.filings.map((f) => ({ filing: f, filingType: 'DEF 14A' })),
  ]

  for (const { filing, filingType } of allFilings) {
    try {
      await ingestSingleFiling(company, filing, filingType, result)
    } catch (err) {
      const msg = `Failed to ingest ${filingType} ${filing.accessionNo}: ${err instanceof Error ? err.message : String(err)}`
      console.info(`[FilingIngestion] ${msg}`)
      result.errors.push(msg)
    }
  }

  return result
}

async function ingestSingleFiling(
  company: CompanyRecord,
  filing: Filing,
  filingType: string,
  result: FilingIngestionResult,
): Promise<void> {
  const db = getDb()
  const client = getSecApiClient()

  // Check for existing record (idempotency)
  const existing = await db
    .select({ id: filingSummaries.id })
    .from(filingSummaries)
    .where(
      eq(filingSummaries.accessionNumber, filing.accessionNo),
    )
    .limit(1)

  if (existing.length > 0) {
    result.skipped++
    return
  }

  // Build raw_data with additional extracted content
  const rawData: Record<string, unknown> = { ...filing }

  // For 10-K/10-Q, get XBRL structured data and key sections
  if ((filingType === '10-K' || filingType === '10-Q') && filing.linkToFilingDetails) {
    const [xbrl, sections] = await Promise.all([
      safeXbrl(client, filing),
      extractSections(client, filing, filingType),
    ])
    if (xbrl) rawData.xbrlData = xbrl
    if (sections) rawData.extractedSections = sections
  }

  await db.insert(filingSummaries).values({
    companyId: company.id,
    filingType,
    periodEnd: filing.periodOfReport ?? null,
    filedAt: filing.filedAt,
    accessionNumber: filing.accessionNo,
    rawData,
    aiSummary: null,
  })

  result.ingested++
}

async function safeXbrl(
  client: ReturnType<typeof getSecApiClient>,
  filing: Filing,
): Promise<unknown | null> {
  try {
    if (filing.linkToFilingDetails) {
      return await client.xbrlToJson({ htmUrl: filing.linkToFilingDetails })
    }
    if (filing.accessionNo) {
      return await client.xbrlToJson({ accessionNo: filing.accessionNo })
    }
    return null
  } catch {
    console.info(`[FilingIngestion] XBRL extraction failed for ${filing.accessionNo}`)
    return null
  }
}

async function extractSections(
  client: ReturnType<typeof getSecApiClient>,
  filing: Filing,
  filingType: string,
): Promise<Record<string, string> | null> {
  if (!filing.linkToFilingDetails) return null

  const sections: Record<string, string> = {}
  const url = filing.linkToFilingDetails

  // Define which sections to extract based on filing type
  const sectionItems =
    filingType === '10-K'
      ? [
          { key: 'businessOverview', item: TenKSection.BUSINESS_OVERVIEW },
          { key: 'riskFactors', item: TenKSection.RISK_FACTORS },
          { key: 'mdAndA', item: TenKSection.MD_AND_A },
          { key: 'legalProceedings', item: TenKSection.LEGAL_PROCEEDINGS },
        ]
      : filingType === '10-Q'
        ? [
            { key: 'mdAndA', item: 'part1item2' as const },
            { key: 'riskFactors', item: 'part2item1a' as const },
          ]
        : []

  const results = await Promise.allSettled(
    sectionItems.map(async ({ key, item }) => {
      const text = await client.extractSection(url, item)
      return { key, text }
    }),
  )

  for (const settledResult of results) {
    if (settledResult.status === 'fulfilled' && settledResult.value.text) {
      sections[settledResult.value.key] = settledResult.value.text
    }
  }

  return Object.keys(sections).length > 0 ? sections : null
}
