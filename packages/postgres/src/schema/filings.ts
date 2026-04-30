import { date, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies'

// As of migration 20260429000000_per_section_summaries.sql, ai_summary and
// human_summary on this table are rollup-only: executive_summary,
// employee_impact, and structured XBRL statements (income_statement,
// balance_sheet, cash_flow, shareholders_equity). Per-item summaries
// (Item 1 Business Overview, Item 7 MD&A, etc.) live on filing_sections —
// reviewers can verify those item-by-item.
export const filingSummaries = pgTable(
  'filing_summaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    filingType: text('filing_type').notNull(),
    periodEnd: date('period_end', { mode: 'string' }),
    filedAt: timestamp('filed_at', { mode: 'string' }).notNull(),
    accessionNumber: text('accession_number').notNull().unique(),
    rawData: jsonb('raw_data').notNull(),
    rawDataOverride: jsonb('raw_data_override'),
    aiSummary: jsonb('ai_summary'),
    humanSummary: jsonb('human_summary'),
    summaryVersion: integer('summary_version').notNull().default(1),
    summarizationStatus: text('summarization_status').notNull().default('ai_generated'),
    summarizationUpdatedAt: timestamp('summarization_updated_at', { mode: 'string' })
      .notNull()
      .defaultNow(),
    summarizationUpdatedBy: uuid('summarization_updated_by'),
    optimisticLockVersion: integer('optimistic_lock_version').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('filing_summaries_company_type_period_idx').on(
      table.companyId,
      table.filingType,
      table.periodEnd,
    ),
    index('filing_summaries_review_status_idx').on(
      table.summarizationStatus,
      table.summarizationUpdatedAt,
    ),
    index('filing_summaries_review_company_idx').on(
      table.companyId,
      table.summarizationStatus,
      table.summarizationUpdatedAt,
    ),
  ],
)

export type SummarizationStatus =
  | 'ai_generated'
  | 'human_verified'
  | 'human_edited'
  | 'human_authored'
