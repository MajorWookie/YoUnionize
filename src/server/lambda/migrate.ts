/**
 * Lambda handler for running Drizzle database migrations at deploy time.
 *
 * Invoked by SST during deployment to keep the schema in sync.
 */

import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

export async function handler() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  console.info('[Lambda:Migrate] Starting database migration...')

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 1,
  })

  try {
    const db = drizzle(pool)
    await migrate(db, { migrationsFolder: './src/database/migrations' })
    console.info('[Lambda:Migrate] Migrations applied successfully')
    return { statusCode: 200, body: 'Migrations complete' }
  } finally {
    await pool.end()
  }
}
