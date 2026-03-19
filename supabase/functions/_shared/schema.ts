/**
 * Drizzle schema definitions for Supabase Edge Functions.
 * Mirrors src/database/schema/ but consolidated for Deno imports.
 */

import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// ── Users ───────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
})

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  jobTitle: text('job_title'),
  orgLevelCode: text('org_level_code'),
  grossAnnualPay: integer('gross_annual_pay'),
  companyTicker: text('company_ticker'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
})

export const userCostOfLiving = pgTable('user_cost_of_living', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  rentMortgage: integer('rent_mortgage'),
  internet: integer('internet'),
  mobilePhone: integer('mobile_phone'),
  utilities: integer('utilities'),
  studentLoans: integer('student_loans'),
  consumerDebt: integer('consumer_debt'),
  carLoan: integer('car_loan'),
  groceries: integer('groceries'),
  gym: integer('gym'),
  entertainment: integer('entertainment'),
  clothing: integer('clothing'),
  savingsTarget: integer('savings_target'),
  other: integer('other'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
})

// ── Companies ───────────────────────────────────────────────────────────

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

// ── Filings ─────────────────────────────────────────────────────────────

export const filingSummaries = pgTable(
  'filing_summaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    filingType: text('filing_type').notNull(),
    periodEnd: date('period_end', { mode: 'string' }),
    filedAt: timestamp('filed_at', { mode: 'string' }).notNull(),
    accessionNumber: text('accession_number').notNull().unique(),
    rawData: jsonb('raw_data').notNull(),
    aiSummary: jsonb('ai_summary'),
    summaryVersion: integer('summary_version').default(1),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('filing_summaries_company_type_period_idx').on(
      table.companyId,
      table.filingType,
      table.periodEnd,
    ),
  ],
)

// ── Executive Compensation ──────────────────────────────────────────────

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

// ── Insider Trades ──────────────────────────────────────────────────────

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
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})

// ── Directors ───────────────────────────────────────────────────────────

export const directors = pgTable('directors', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  title: text('title').notNull(),
  isIndependent: boolean('is_independent'),
  committees: jsonb('committees'),
  tenureStart: text('tenure_start'),
  age: integer('age'),
  directorClass: text('director_class'),
  qualifications: jsonb('qualifications'),
  role: text('role'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})

// ── Embeddings (pgvector) ───────────────────────────────────────────────

const vector = customType<{ data: number[]; dpiType: string }>({
  dataType() {
    return 'vector(1536)'
  },
  toDriver(value: number[]) {
    return `[${value.join(',')}]`
  },
  fromDriver(value: unknown) {
    if (typeof value === 'string') {
      return value.slice(1, -1).split(',').map(Number)
    }
    return value as number[]
  },
})

export const embeddings = pgTable('embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceType: text('source_type').notNull(),
  sourceId: uuid('source_id').notNull(),
  contentHash: text('content_hash').notNull(),
  embedding: vector('embedding').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})

// ── Compensation Analyses ───────────────────────────────────────────────

export const compensationAnalyses = pgTable('compensation_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  analysisData: jsonb('analysis_data').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})

// ── Jobs ────────────────────────────────────────────────────────────────

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pending'),
  result: jsonb('result'),
  error: text('error'),
  parentJobId: uuid('parent_job_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { mode: 'string' }),
  completedAt: timestamp('completed_at', { mode: 'string' }),
})

// ── Raw SEC Responses ──────────────────────────────────────────────────

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

// ── Form 8-K Events ────────────────────────────────────────────────────

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
