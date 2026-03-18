import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // 'ingest' | 'summarize'
  payload: jsonb('payload').notNull(), // { ticker, companyId, etc. }
  status: text('status').notNull().default('pending'), // pending | running | completed | failed
  result: jsonb('result'),
  error: text('error'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { mode: 'string' }),
  completedAt: timestamp('completed_at', { mode: 'string' }),
})
