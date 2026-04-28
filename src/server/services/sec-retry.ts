import { and, eq } from 'drizzle-orm'
import { getDb, rawSecResponses } from '@younionize/postgres'
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
