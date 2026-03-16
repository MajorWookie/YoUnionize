import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const compensationAnalyses = pgTable('compensation_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  analysisData: jsonb('analysis_data').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})
