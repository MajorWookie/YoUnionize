import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from '../../../src/database/schema'
import * as relations from '../../../src/database/relations'

const combinedSchema = { ...schema, ...relations }

type Database = NodePgDatabase<typeof combinedSchema>

let db: Database | undefined

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString })
}

export function createDb(connectionString: string): Database {
  const pool = createPool(connectionString)
  return drizzle(pool, { schema: combinedSchema })
}

export function getDb(): Database {
  if (!db) {
    const url = process.env.DATABASE_URL
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    db = createDb(url)
  }
  return db
}
