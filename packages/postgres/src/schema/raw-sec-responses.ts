import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies'

export const rawSecResponses = pgTable('raw_sec_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  subKey: text('sub_key'),
  rawResponse: jsonb('raw_response').notNull(),
  fetchStatus: text('fetch_status').notNull().default('complete'),
  fetchError: text('fetch_error'),
  processStatus: text('process_status').notNull().default('pending'),
  processedAt: timestamp('processed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})
