import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'
import * as relations from './relations'

const combinedSchema = { ...schema, ...relations }

type Database = PostgresJsDatabase<typeof combinedSchema>

let db: Database | undefined

export function createDb(connectionString: string): Database {
  const client = postgres(connectionString)
  return drizzle(client, { schema: combinedSchema })
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
