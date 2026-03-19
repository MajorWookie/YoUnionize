import { bigint, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
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
  totalCompensation: bigint('total_compensation', { mode: 'number' }).notNull(),
  salary: bigint('salary', { mode: 'number' }),
  bonus: bigint('bonus', { mode: 'number' }),
  stockAwards: bigint('stock_awards', { mode: 'number' }),
  optionAwards: bigint('option_awards', { mode: 'number' }),
  nonEquityIncentive: bigint('non_equity_incentive', { mode: 'number' }),
  otherCompensation: bigint('other_compensation', { mode: 'number' }),
  ceoPayRatio: numeric('ceo_pay_ratio'),
  changeInPensionValue: bigint('change_in_pension_value', { mode: 'number' }),
  canonicalName: text('canonical_name'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})
