import { and, eq } from 'drizzle-orm'
import {
  getDb,
  filingSections,
  filingSummaries,
  rawSecResponses,
} from '@younionize/postgres'
import { getSecApiClient } from '../sec-api-client'
import { pMapSettled } from '@younionize/helpers'
import type { CompanyRecord } from './company-lookup'
import { fetchAllSecData } from './sec-fetcher'
import { processRawSecData } from './raw-data-processor'

export interface RetryResult {
  /** Rows in fetch_status='error' before retry */
  fetchErrorsBefore: number
  /** Rows in process_status='failed' before retry */
  processFailuresBefore: number
  /** Whether we re-ran fetchAllSecData for this company */
  refetched: boolean
  /** Whether we re-ran processRawSecData for this company */
  reprocessed: boolean
  /** Rows still in fetch_status='error' after retry (terminal failures) */
  fetchErrorsAfter: number
  /** Rows still in process_status='failed' after retry */
  processFailuresAfter: number
  /** Per-endpoint counts of remaining errors */
  remainingByEndpoint: Record<string, number>
}

/**
 * Operational recovery for raw_sec_responses rows that ended in a terminal
 * state (fetch_status='error' from upstream sec-api failures, or
 * process_status='failed' from a downstream transformation crash).
 *
 * Two-phase recovery:
 *   1. Re-fetch: if any rows are in fetch_status='error', re-run
 *      fetchAllSecData(company). The fetcher upserts on (company_id,
 *      endpoint, sub_key), so successful re-attempts overwrite the error
 *      row in place. Section-level errors are resolved when their
 *      individual extractSection calls succeed on retry.
 *   2. Re-process: any rows in process_status='failed' are reset to
 *      'pending' and processRawSecData re-runs the transformation.
 *
 * Idempotent: safe to call repeatedly. If everything's already healthy,
 * both phases are skipped and the result reports zero work done.
 */
export async function retryFailedRawResponses(
  company: CompanyRecord,
): Promise<RetryResult> {
  const db = getDb()

  const fetchErrorsBefore = await countByFetchStatus(db, company.id, 'error')
  const processFailuresBefore = await countByProcessStatus(db, company.id, 'failed')

  let refetched = false
  let reprocessed = false

  if (fetchErrorsBefore > 0) {
    console.info(
      `[SecRetry] ${company.ticker}: re-fetching (${fetchErrorsBefore} fetch errors)`,
    )
    await fetchAllSecData(company)
    refetched = true
  }

  if (processFailuresBefore > 0) {
    // Reset failed rows to pending so processRawSecData picks them up.
    await db
      .update(rawSecResponses)
      .set({ processStatus: 'pending', processedAt: null })
      .where(
        and(
          eq(rawSecResponses.companyId, company.id),
          eq(rawSecResponses.processStatus, 'failed'),
        ),
      )
  }

  // Re-process if either we just re-fetched (which set new rows to 'pending')
  // or we just reset failed rows to 'pending'.
  if (refetched || processFailuresBefore > 0) {
    console.info(`[SecRetry] ${company.ticker}: re-processing pending rows`)
    await processRawSecData(company, { skipSummarization: true })
    reprocessed = true
  }

  const fetchErrorsAfter = await countByFetchStatus(db, company.id, 'error')
  const processFailuresAfter = await countByProcessStatus(db, company.id, 'failed')
  const remainingByEndpoint = await countErrorsByEndpoint(db, company.id)

  return {
    fetchErrorsBefore,
    processFailuresBefore,
    refetched,
    reprocessed,
    fetchErrorsAfter,
    processFailuresAfter,
    remainingByEndpoint,
  }
}

async function countByFetchStatus(
  db: ReturnType<typeof getDb>,
  companyId: string,
  status: string,
): Promise<number> {
  const rows = await db
    .select({ id: rawSecResponses.id })
    .from(rawSecResponses)
    .where(
      and(
        eq(rawSecResponses.companyId, companyId),
        eq(rawSecResponses.fetchStatus, status),
      ),
    )
  return rows.length
}

async function countByProcessStatus(
  db: ReturnType<typeof getDb>,
  companyId: string,
  status: string,
): Promise<number> {
  const rows = await db
    .select({ id: rawSecResponses.id })
    .from(rawSecResponses)
    .where(
      and(
        eq(rawSecResponses.companyId, companyId),
        eq(rawSecResponses.processStatus, status),
      ),
    )
  return rows.length
}

async function countErrorsByEndpoint(
  db: ReturnType<typeof getDb>,
  companyId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({ endpoint: rawSecResponses.endpoint })
    .from(rawSecResponses)
    .where(
      and(
        eq(rawSecResponses.companyId, companyId),
        eq(rawSecResponses.fetchStatus, 'error'),
      ),
    )

  const counts: Record<string, number> = {}
  for (const row of rows) {
    counts[row.endpoint] = (counts[row.endpoint] ?? 0) + 1
  }
  return counts
}

// ─── Section-level retry ────────────────────────────────────────────────────
// `retryFailedRawResponses` only sees errors that landed in raw_sec_responses
// (the production Edge Function path). The seed script writes directly to
// filing_sections, so its errors live only on those rows. This function
// replays them by re-calling extractSection for each errored row, leveraging
// the SecApiClient's "processing" polling and 429 backoff. Idempotent.

const SECTION_RETRY_CONCURRENCY = 4

export interface SectionRetryResult {
  errorsBefore: number
  errorsAfter: number
  recovered: number
  stillFailing: number
}

export async function retryFailedFilingSections(
  company: CompanyRecord,
): Promise<SectionRetryResult> {
  const db = getDb()
  const client = getSecApiClient()

  // Pull every errored section row + its parent filing's URL in one shot.
  // raw_data on filing_summaries holds the original Filing JSON, which is
  // where linkToFilingDetails (sec-api's per-filing canonical URL) lives.
  const errorRows = await db
    .select({
      id: filingSections.id,
      sectionCode: filingSections.sectionCode,
      filingId: filingSections.filingId,
      rawData: filingSummaries.rawData,
    })
    .from(filingSections)
    .innerJoin(filingSummaries, eq(filingSections.filingId, filingSummaries.id))
    .where(
      and(
        eq(filingSummaries.companyId, company.id),
        eq(filingSections.fetchStatus, 'error'),
      ),
    )

  const errorsBefore = errorRows.length
  if (errorsBefore === 0) {
    return { errorsBefore: 0, errorsAfter: 0, recovered: 0, stillFailing: 0 }
  }

  console.info(
    `[SecRetry] ${company.ticker}: replaying ${errorsBefore} filing_sections errors ` +
      `(concurrency=${SECTION_RETRY_CONCURRENCY})`,
  )

  // Single heartbeat every 10s so the script never goes silent.
  let completed = 0
  let succeeded = 0
  let failed = 0
  const startMs = Date.now()
  const heartbeat = setInterval(() => {
    const elapsedSec = Math.round((Date.now() - startMs) / 1000)
    console.info(
      `[SecRetry] ${company.ticker}: ${completed}/${errorsBefore} ` +
        `(${succeeded} ok, ${failed} fail) — ${elapsedSec}s elapsed`,
    )
  }, 10_000)

  let settled: Array<PromiseSettledResult<{ id: string; sectionCode: string; text: string }>>
  try {
    settled = await pMapSettled(
      errorRows,
      async (row) => {
        const url = (row.rawData as Record<string, unknown>)?.linkToFilingDetails as
          | string
          | undefined
        if (!url) {
          throw new Error('parent filing has no linkToFilingDetails')
        }
        try {
          const text = await client.extractSection(url, row.sectionCode as never)
          succeeded++
          return { id: row.id, sectionCode: row.sectionCode, text }
        } catch (err) {
          failed++
          throw err
        } finally {
          completed++
        }
      },
      SECTION_RETRY_CONCURRENCY,
    )
  } finally {
    clearInterval(heartbeat)
  }

  let recovered = 0
  for (let i = 0; i < settled.length; i++) {
    const entry = settled[i]
    const row = errorRows[i]

    if (entry.status === 'fulfilled') {
      const { text } = entry.value
      const trimmed = text?.trim() ?? ''
      const status = trimmed.length === 0 ? 'empty' : 'success'
      // summary_version=0 so the section pipeline picks this row up next run.
      await db
        .update(filingSections)
        .set({
          text: status === 'success' ? text : null,
          fetchStatus: status,
          fetchError: null,
          extractedAt: new Date().toISOString(),
          summaryVersion: 0,
          summarizationStatus: 'ai_generated',
        })
        .where(eq(filingSections.id, row.id))
      if (status === 'success') recovered++
    } else {
      const errMsg =
        entry.reason instanceof Error ? entry.reason.message : String(entry.reason)
      await db
        .update(filingSections)
        .set({
          fetchError: errMsg,
          extractedAt: new Date().toISOString(),
        })
        .where(eq(filingSections.id, row.id))
    }
  }

  const errorsAfter = await db
    .select({ id: filingSections.id })
    .from(filingSections)
    .innerJoin(filingSummaries, eq(filingSections.filingId, filingSummaries.id))
    .where(
      and(
        eq(filingSummaries.companyId, company.id),
        eq(filingSections.fetchStatus, 'error'),
      ),
    )
    .then((rows) => rows.length)

  return {
    errorsBefore,
    errorsAfter,
    recovered,
    stillFailing: errorsAfter,
  }
}
