import { bigint, boolean, date, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
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
  totalValue: bigint('total_value', { mode: 'number' }),
  filingUrl: text('filing_url'),
  isDerivative: boolean('is_derivative').notNull().default(false),
  accessionNumber: text('accession_number'),
  securityTitle: text('security_title'),
  sharesOwnedAfter: numeric('shares_owned_after'),
  transactionDescription: text('transaction_description'),
  directOrIndirect: text('direct_or_indirect'),
  exerciseDate: text('exercise_date'),
  expirationDate: text('expiration_date'),
  conversionOrExercisePrice: numeric('conversion_or_exercise_price'),
  underlyingSecurityTitle: text('underlying_security_title'),
  underlyingSecurityShares: numeric('underlying_security_shares'),
  extraData: jsonb('extra_data'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})
