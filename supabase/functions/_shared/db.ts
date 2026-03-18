import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

let db: PostgresJsDatabase | undefined

export function getDb(): PostgresJsDatabase {
  if (!db) {
    const url = Deno.env.get('DATABASE_URL')
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    const client = postgres(url)
    db = drizzle(client)
  }
  return db
}
