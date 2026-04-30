import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticker: text('ticker').notNull().unique(),
  name: text('name').notNull(),
  cik: text('cik').notNull().unique(),
  sector: text('sector'),
  industry: text('industry'),
  exchange: text('exchange'),
  lastFetchAt: timestamp('last_fetch_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
})
