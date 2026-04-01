import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

let db: PostgresJsDatabase | undefined

export function getDb(): PostgresJsDatabase {
  if (!db) {
    // Prefer SUPABASE_DB_URL (auto-injected, uses Docker-internal hostname)
    // over DATABASE_URL (from .env, uses host-side 127.0.0.1 — unreachable from Docker)
    const url = Deno.env.get('SUPABASE_DB_URL') ?? Deno.env.get('DATABASE_URL')
    if (!url) {
      throw new Error('SUPABASE_DB_URL or DATABASE_URL environment variable must be set')
    }
    const client = postgres(url)
    db = drizzle(client)
  }
  return db
}
