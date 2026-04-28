import { date, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies'

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
    aiSummary: jsonb('ai_summary'),
    summaryVersion: integer('summary_version').default(1),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('filing_summaries_company_type_period_idx').on(
      table.companyId,
      table.filingType,
      table.periodEnd,
    ),
  ],
)
