import { date, jsonb, pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core'
import { companies } from './companies'

export const directors = pgTable('directors', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  title: text('title').notNull(),
  isIndependent: boolean('is_independent'),
  committees: jsonb('committees'),
  tenureStart: date('tenure_start', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})
