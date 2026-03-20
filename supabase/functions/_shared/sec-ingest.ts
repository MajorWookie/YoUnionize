/**
 * Lightweight DB insert helpers for directors and compensation.
 *
 * These mirror the logic in src/server/services/directors-ingestion.ts and
 * src/server/services/compensation-ingestion.ts but run in Deno Edge Functions.
 * Enrichment (role classification, canonical names) is intentionally skipped —
 * it runs during the full ingestion pipeline via Lambda workers.
 *
 * Keep column mappings in sync with the Node/Bun ingestion services.
 */

import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { directors, executiveCompensation } from './schema.ts'
import { fetchDirectorsFromSec, fetchCompensationFromSec } from './sec-fetch.ts'

interface IngestResult {
  ingested: number
  errors: Array<string>
}

/** Convert empty or whitespace-only strings to null. */
function emptyToNull(value: unknown): string | null {
  if (value == null) return null
  const str = String(value).trim()
  return str.length > 0 ? str : null
}

/**
 * Fetch directors from SEC API and insert any missing ones into the database.
 * Idempotent: skips directors already stored (by companyId + name).
 */
export async function ingestDirectorsFromSec(
  db: PostgresJsDatabase,
  companyId: string,
  ticker: string,
  apiKey: string,
): Promise<IngestResult> {
  const result: IngestResult = { ingested: 0, errors: [] }

  const rawDirectors = await fetchDirectorsFromSec(apiKey, ticker)
  if (rawDirectors.length === 0) return result

  const insertResults = await Promise.allSettled(
    rawDirectors.map(async (director) => {
      const name = emptyToNull(director.name) ?? 'Unknown'

      // Check for existing record
      const existing = await db
        .select({ id: directors.id })
        .from(directors)
        .where(and(eq(directors.companyId, companyId), eq(directors.name, name)))
        .limit(1)

      if (existing.length > 0) return 'skipped'

      await db.insert(directors).values({
        companyId,
        name,
        title: emptyToNull(director.position) ?? 'Director',
        isIndependent: (director.isIndependent as boolean) ?? null,
        committees: (director.committeeMemberships as unknown) ?? null,
        tenureStart: emptyToNull(director.dateFirstElected),
        age: director.age ? Number(director.age) : null,
        directorClass: emptyToNull(director.directorClass),
        qualifications: (director.qualificationsAndExperience as unknown) ?? null,
      })

      return 'ingested'
    }),
  )

  for (const settled of insertResults) {
    if (settled.status === 'fulfilled' && settled.value === 'ingested') {
      result.ingested++
    } else if (settled.status === 'rejected') {
      result.errors.push(
        `Director insert failed: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`,
      )
    }
  }

  console.info(
    `[sec-ingest] Directors for ${ticker}: ${result.ingested} ingested, ${result.errors.length} errors`,
  )
  return result
}

/**
 * Fetch executive compensation from SEC API and insert any missing records.
 * Idempotent: skips records that already exist (by companyId + executiveName + fiscalYear).
 */
export async function ingestCompensationFromSec(
  db: PostgresJsDatabase,
  companyId: string,
  ticker: string,
  apiKey: string,
): Promise<IngestResult> {
  const result: IngestResult = { ingested: 0, errors: [] }

  const rawExecs = await fetchCompensationFromSec(apiKey, ticker)
  if (rawExecs.length === 0) return result

  const insertResults = await Promise.allSettled(
    rawExecs.map(async (exec) => {
      const fiscalYear = (exec.year as number) ?? 0
      const execName = emptyToNull(exec.name) ?? 'Unknown'

      // Check for existing record (idempotency)
      const existing = await db
        .select({ id: executiveCompensation.id })
        .from(executiveCompensation)
        .where(
          and(
            eq(executiveCompensation.companyId, companyId),
            eq(executiveCompensation.executiveName, execName),
            eq(executiveCompensation.fiscalYear, fiscalYear),
          ),
        )
        .limit(1)

      if (existing.length > 0) return 'skipped'

      await db.insert(executiveCompensation).values({
        companyId,
        fiscalYear,
        executiveName: execName,
        title: (exec.position as string) ?? 'Unknown',
        totalCompensation: (exec.total as number) ?? 0,
        salary: (exec.salary as number) ?? null,
        bonus: (exec.bonus as number) ?? null,
        stockAwards: (exec.stockAwards as number) ?? null,
        optionAwards: (exec.optionAwards as number) ?? null,
        nonEquityIncentive: (exec.nonEquityIncentiveCompensation as number) ?? null,
        otherCompensation: (exec.otherCompensation as number) ?? null,
        ceoPayRatio: exec.ceoPayRatio != null ? String(exec.ceoPayRatio) : null,
      })

      return 'ingested'
    }),
  )

  for (const settled of insertResults) {
    if (settled.status === 'fulfilled' && settled.value === 'ingested') {
      result.ingested++
    } else if (settled.status === 'rejected') {
      result.errors.push(
        `Compensation insert failed: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`,
      )
    }
  }

  console.info(
    `[sec-ingest] Compensation for ${ticker}: ${result.ingested} ingested, ${result.errors.length} errors`,
  )
  return result
}
