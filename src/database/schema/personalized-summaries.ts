import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { filingSummaries } from './filings'

export const personalizedSummaries = pgTable('personalized_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  filingId: uuid('filing_id')
    .notNull()
    .references(() => filingSummaries.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
})
