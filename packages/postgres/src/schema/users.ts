import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
