import { integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { filingSummaries } from './filings'

export const executiveCompensation = pgTable('executive_compensation', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  filingSummaryId: uuid('filing_summary_id').references(() => filingSummaries.id, {
    onDelete: 'set null',
  }),
  fiscalYear: integer('fiscal_year').notNull(),
  executiveName: text('executive_name').notNull(),
  title: text('title').notNull(),
  totalCompensation: integer('total_compensation').notNull(),
  salary: integer('salary'),
  bonus: integer('bonus'),
  stockAwards: integer('stock_awards'),
  optionAwards: integer('option_awards'),
  nonEquityIncentive: integer('non_equity_incentive'),
  otherCompensation: integer('other_compensation'),
  ceoPayRatio: numeric('ceo_pay_ratio'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})
