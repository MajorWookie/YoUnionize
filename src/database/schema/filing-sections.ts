import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { filingSummaries } from './filings'

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
  },
  (table) => [
    uniqueIndex('filing_sections_filing_code_idx').on(table.filingId, table.sectionCode),
    index('filing_sections_filing_id_idx').on(table.filingId),
    index('filing_sections_code_idx').on(table.sectionCode),
  ],
)

export type FetchStatus = 'success' | 'empty' | 'error'
