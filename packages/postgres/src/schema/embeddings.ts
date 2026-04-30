import { customType, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

const vector = customType<{ data: number[]; dpiType: string }>({
  dataType() {
    return 'vector(1024)'
  },
  toDriver(value: number[]) {
    return `[${value.join(',')}]`
  },
  fromDriver(value: unknown) {
    if (typeof value === 'string') {
      return value
        .slice(1, -1)
        .split(',')
        .map(Number)
    }
    return value as number[]
  },
})

// HNSW vector index is created in a custom migration since drizzle-kit
// doesn't support the .using() syntax for custom index methods.
// See: src/database/migrations/0001_enable_pgvector.sql
export const embeddings = pgTable('embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceType: text('source_type').notNull(),
  sourceId: uuid('source_id').notNull(),
  contentHash: text('content_hash').notNull(),
  embedding: vector('embedding').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
})
