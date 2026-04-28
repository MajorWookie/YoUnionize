// Pure helpers and DB operations for the human review pipeline.
//
// Edge Functions stay thin — they handle HTTP, auth, and validation, then
// call into these helpers. Same code path is consumed by every review-*
// Edge Function (Phase 1 CLI today, Phase 2 UI later).

import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { companies, filingSummaries } from './schema.ts'
import { getDb } from './db.ts'
import type { SummarizationStatus } from './review-diff.ts'

export type { SummarizationStatus }

export const ALL_STATUSES: ReadonlyArray<SummarizationStatus> = [
  'ai_generated',
  'human_verified',
  'human_edited',
  'human_authored',
]

export function isValidStatus(value: unknown): value is SummarizationStatus {
  return typeof value === 'string' && (ALL_STATUSES as ReadonlyArray<string>).includes(value)
}

// ── Errors ────────────────────────────────────────────────────────────────

export class ReviewNotFoundError extends Error {
  constructor(filingId: string) {
    super(`Filing ${filingId} not found`)
    this.name = 'ReviewNotFoundError'
  }
}

export class OptimisticLockError extends Error {
  constructor(public readonly filingId: string, public readonly expected: number, public readonly actual: number) {
    super(
      `Optimistic lock conflict on filing ${filingId}: expected version ${expected}, got ${actual}`,
    )
    this.name = 'OptimisticLockError'
  }
}

// ── Read shapes ───────────────────────────────────────────────────────────

export interface ReviewItem {
  id: string
  companyId: string
  companyTicker: string
  companyName: string
  filingType: string
  accessionNumber: string
  filedAt: string
  periodEnd: string | null
  rawData: Record<string, unknown>
  rawDataOverride: Record<string, unknown> | null
  aiSummary: Record<string, unknown> | null
  humanSummary: Record<string, unknown> | null
  summaryVersion: number
  summarizationStatus: SummarizationStatus
  summarizationUpdatedAt: string
  summarizationUpdatedBy: string | null
  optimisticLockVersion: number
}

export interface ReviewListItem {
  id: string
  companyTicker: string
  companyName: string
  filingType: string
  accessionNumber: string
  filedAt: string
  summarizationStatus: SummarizationStatus
  summarizationUpdatedAt: string
  summaryVersion: number
}

// ── Reads ─────────────────────────────────────────────────────────────────

export async function listReviewItems(opts: {
  ticker?: string
  status?: ReadonlyArray<SummarizationStatus | 'failed'>
  limit?: number
}): Promise<Array<ReviewListItem>> {
  const db = getDb()
  const limit = opts.limit ?? 200

  const where = []
  if (opts.ticker) {
    where.push(eq(companies.ticker, opts.ticker.toUpperCase()))
  }

  // 'failed' is a virtual status: rows where summary_version = -1.
  // Other status values map directly to summarization_status.
  const realStatuses = (opts.status ?? []).filter(
    (s): s is SummarizationStatus => s !== 'failed',
  )
  const includeFailed = (opts.status ?? []).includes('failed')

  if (realStatuses.length > 0 && !includeFailed) {
    where.push(inArray(filingSummaries.summarizationStatus, realStatuses as Array<string>))
  } else if (realStatuses.length > 0 && includeFailed) {
    where.push(
      sql`(${filingSummaries.summarizationStatus} = ANY(${realStatuses}) OR ${filingSummaries.summaryVersion} = -1)`,
    )
  } else if (includeFailed) {
    where.push(eq(filingSummaries.summaryVersion, -1))
  }

  const rows = await db
    .select({
      id: filingSummaries.id,
      companyTicker: companies.ticker,
      companyName: companies.name,
      filingType: filingSummaries.filingType,
      accessionNumber: filingSummaries.accessionNumber,
      filedAt: filingSummaries.filedAt,
      summarizationStatus: filingSummaries.summarizationStatus,
      summarizationUpdatedAt: filingSummaries.summarizationUpdatedAt,
      summaryVersion: filingSummaries.summaryVersion,
    })
    .from(filingSummaries)
    .innerJoin(companies, eq(companies.id, filingSummaries.companyId))
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(filingSummaries.summarizationUpdatedAt))
    .limit(limit)

  return rows.map((r) => ({
    ...r,
    summarizationStatus: r.summarizationStatus as SummarizationStatus,
  }))
}

export async function getReviewItem(filingId: string): Promise<ReviewItem> {
  const db = getDb()
  const rows = await db
    .select({
      id: filingSummaries.id,
      companyId: filingSummaries.companyId,
      companyTicker: companies.ticker,
      companyName: companies.name,
      filingType: filingSummaries.filingType,
      accessionNumber: filingSummaries.accessionNumber,
      filedAt: filingSummaries.filedAt,
      periodEnd: filingSummaries.periodEnd,
      rawData: filingSummaries.rawData,
      rawDataOverride: filingSummaries.rawDataOverride,
      aiSummary: filingSummaries.aiSummary,
      humanSummary: filingSummaries.humanSummary,
      summaryVersion: filingSummaries.summaryVersion,
      summarizationStatus: filingSummaries.summarizationStatus,
      summarizationUpdatedAt: filingSummaries.summarizationUpdatedAt,
      summarizationUpdatedBy: filingSummaries.summarizationUpdatedBy,
      optimisticLockVersion: filingSummaries.optimisticLockVersion,
    })
    .from(filingSummaries)
    .innerJoin(companies, eq(companies.id, filingSummaries.companyId))
    .where(eq(filingSummaries.id, filingId))
    .limit(1)

  if (rows.length === 0) throw new ReviewNotFoundError(filingId)
  const r = rows[0]
  return {
    ...r,
    rawData: r.rawData as Record<string, unknown>,
    rawDataOverride: r.rawDataOverride as Record<string, unknown> | null,
    aiSummary: r.aiSummary as Record<string, unknown> | null,
    humanSummary: r.humanSummary as Record<string, unknown> | null,
    summarizationStatus: r.summarizationStatus as SummarizationStatus,
  }
}

// ── Writes ────────────────────────────────────────────────────────────────

interface WriteOpts {
  filingId: string
  expectedLockVersion: number
  actor: string | null
}

/**
 * Update a filing row inside a single optimistic-lock transaction.
 * The where-clause requires the lock version to match; if it doesn't, the
 * UPDATE returns 0 rows and we throw OptimisticLockError.
 */
async function updateReview(
  opts: WriteOpts,
  patch: Partial<{
    rawDataOverride: Record<string, unknown> | null
    humanSummary: Record<string, unknown> | null
    summaryVersion: number
    summarizationStatus: SummarizationStatus
  }>,
): Promise<void> {
  const db = getDb()
  const next = {
    ...patch,
    summarizationUpdatedAt: new Date().toISOString(),
    summarizationUpdatedBy: opts.actor,
    optimisticLockVersion: opts.expectedLockVersion + 1,
    updatedAt: new Date().toISOString(),
  }

  const updated = await db
    .update(filingSummaries)
    .set(next)
    .where(
      and(
        eq(filingSummaries.id, opts.filingId),
        eq(filingSummaries.optimisticLockVersion, opts.expectedLockVersion),
      ),
    )
    .returning({ id: filingSummaries.id })

  if (updated.length === 0) {
    // Distinguish "row missing" from "lock conflict"
    const existing = await db
      .select({ optimisticLockVersion: filingSummaries.optimisticLockVersion })
      .from(filingSummaries)
      .where(eq(filingSummaries.id, opts.filingId))
      .limit(1)
    if (existing.length === 0) throw new ReviewNotFoundError(opts.filingId)
    throw new OptimisticLockError(
      opts.filingId,
      opts.expectedLockVersion,
      existing[0].optimisticLockVersion,
    )
  }
}

/**
 * Apply a user edit to raw_data_override. Sets summary_version = 0 so the
 * next summarization run picks up the override; status is unchanged until
 * that run completes.
 */
export async function applyRawOverride(
  opts: WriteOpts,
  override: Record<string, unknown>,
): Promise<void> {
  await updateReview(opts, {
    rawDataOverride: override,
    summaryVersion: 0,
  })
}

export async function clearRawOverride(opts: WriteOpts): Promise<void> {
  await updateReview(opts, {
    rawDataOverride: null,
    summaryVersion: 0,
  })
}

/**
 * Apply a user edit to human_summary and set the new status. The status is
 * computed by the caller using statusFromEdit() in review-diff.ts so the
 * Edge Function stays in control of policy.
 */
export async function applyHumanSummary(
  opts: WriteOpts,
  humanSummary: Record<string, unknown>,
  status: SummarizationStatus,
): Promise<void> {
  await updateReview(opts, {
    humanSummary,
    summarizationStatus: status,
  })
}

export async function clearHumanSummary(opts: WriteOpts): Promise<void> {
  await updateReview(opts, {
    humanSummary: null,
    summarizationStatus: 'ai_generated',
  })
}

/** Mark the AI summary as human-verified without changing its content. */
export async function markVerified(opts: WriteOpts): Promise<void> {
  await updateReview(opts, {
    summarizationStatus: 'human_verified',
  })
}
