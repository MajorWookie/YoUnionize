import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
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
  tenureStart: text('tenure_start'),
  age: integer('age'),
  directorClass: text('director_class'),
  qualifications: jsonb('qualifications'),
  role: text('role'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})
