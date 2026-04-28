import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { filingSummaries } from './filings'

export const form8kEvents = pgTable('form_8k_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  filingSummaryId: uuid('filing_summary_id').references(() => filingSummaries.id, {
    onDelete: 'set null',
  }),
  accessionNumber: text('accession_number').notNull(),
  filedAt: timestamp('filed_at', { mode: 'string' }).notNull(),
  itemType: text('item_type').notNull(),
  eventData: jsonb('event_data').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})
