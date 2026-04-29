import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { filingSummaries } from './filings'

// One row per (filing, SEC section item code). Stores the raw item text plus
// per-item AI summary, human override, and provenance/status — the same
// review pipeline that lives on filing_summaries, pushed down to the item
// grain so reviewers can verify Item 1A independently from Item 7. See
// 20260429000000_per_section_summaries.sql for the column rationale.
export const filingSections = pgTable(
  'filing_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filingId: uuid('filing_id')
      .notNull()
      .references(() => filingSummaries.id, { onDelete: 'cascade' }),
    sectionCode: text('section_code').notNull(),
    text: text('text'),
    fetchStatus: text('fetch_status').notNull().default('success'),
    fetchError: text('fetch_error'),
    extractedAt: timestamp('extracted_at', { mode: 'string' }).notNull().defaultNow(),

    aiSummary: jsonb('ai_summary'),
    humanSummary: jsonb('human_summary'),
    summarizationStatus: text('summarization_status').notNull().default('ai_generated'),
    summarizationUpdatedAt: timestamp('summarization_updated_at', { mode: 'string' })
      .notNull()
      .defaultNow(),
    summarizationUpdatedBy: uuid('summarization_updated_by'),
    summaryVersion: integer('summary_version').notNull().default(0),
    optimisticLockVersion: integer('optimistic_lock_version').notNull().default(0),
    promptId: text('prompt_id'),
  },
  (table) => [
    uniqueIndex('filing_sections_filing_code_idx').on(table.filingId, table.sectionCode),
    index('filing_sections_filing_id_idx').on(table.filingId),
    index('filing_sections_code_idx').on(table.sectionCode),
    index('filing_sections_review_status_idx').on(
      table.summarizationStatus,
      table.summarizationUpdatedAt,
    ),
    index('filing_sections_filing_status_idx').on(table.filingId, table.summarizationStatus),
  ],
)

export type FetchStatus = 'success' | 'empty' | 'error'

// Mirrors filing_summaries.SummarizationStatus, plus 'skipped' for items the
// pipeline intentionally bypasses (empty / sub-threshold raw text).
export type SectionSummarizationStatus =
  | 'ai_generated'
  | 'human_verified'
  | 'human_edited'
  | 'human_authored'
  | 'skipped'
