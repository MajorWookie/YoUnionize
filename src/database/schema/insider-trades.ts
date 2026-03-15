import { date, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies'

export const insiderTrades = pgTable('insider_trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  filerName: text('filer_name').notNull(),
  filerTitle: text('filer_title'),
  transactionDate: date('transaction_date', { mode: 'string' }).notNull(),
  transactionType: text('transaction_type').notNull(),
  shares: numeric('shares').notNull(),
  pricePerShare: numeric('price_per_share'),
  totalValue: integer('total_value'),
  filingUrl: text('filing_url'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})
