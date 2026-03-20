import { and, eq, sql } from 'drizzle-orm'
import { getDb, directors } from '@union/postgres'
import { normalizeName } from '@union/helpers'
import { getSecApiClient } from '../sec-api-client'
import type { CompanyRecord } from './company-lookup'

interface DirectorsIngestionOptions {
  /** Number of proxy filings to fetch (each data[] entry = one filing year). Defaults to 5. */
  filingCount?: number
}

interface DirectorsIngestionResult {
  ingested: number
  skipped: number
  errors: Array<string>
}

/**
 * Ingest directors and board members for a company.
 *
 * The SEC API returns a nested structure: data[] contains filing-level objects,
 * each with a directors[] array. We iterate through filings (most recent first),
 * dedup by director name, and store the most recent data for each director.
 *
 * Idempotent: skips directors already stored (by company + name).
 */
export async function ingestDirectors(
  company: CompanyRecord,
  options?: DirectorsIngestionOptions,
): Promise<DirectorsIngestionResult> {
  const client = getSecApiClient()
  const result: DirectorsIngestionResult = { ingested: 0, skipped: 0, errors: [] }

  try {
    const filingCount = options?.filingCount ?? 5
    const response = await client.searchDirectors({
      query: `ticker:${company.ticker}`,
      from: '0',
      size: String(filingCount),
      sort: [{ filedAt: { order: 'desc' } }],
    })

    const db = getDb()

    // Deduplicate by name across filings — since results are sorted by
    // filedAt desc, the first occurrence of a name is the most recent data
    const seenNames = new Set<string>()

    for (const filing of response.data) {
      const filingDirectors = filing.directors ?? []

      for (const director of filingDirectors) {
        const name = director.name ?? 'Unknown'
        const normalized = normalizeName(name)
        if (seenNames.has(normalized)) continue
        seenNames.add(normalized)

        try {
          await db.insert(directors).values({
            companyId: company.id,
            name,
            normalizedName: normalized,
            title: emptyToNull(director.position) ?? 'Director',
            isIndependent: director.isIndependent ?? null,
            committees: director.committeeMemberships ?? null,
            tenureStart: emptyToNull(director.dateFirstElected),
            age: director.age ? Number(director.age) : null,
            directorClass: emptyToNull(director.directorClass),
            qualifications: director.qualificationsAndExperience ?? null,
          }).onConflictDoUpdate({
            target: [directors.companyId, directors.normalizedName],
            set: {
              title: sql`EXCLUDED.title`,
              isIndependent: sql`EXCLUDED.is_independent`,
              committees: sql`EXCLUDED.committees`,
              tenureStart: sql`EXCLUDED.tenure_start`,
              age: sql`EXCLUDED.age`,
              directorClass: sql`EXCLUDED.director_class`,
              qualifications: sql`EXCLUDED.qualifications`,
            },
          })

          result.ingested++
        } catch (err) {
          const msg = `Failed to ingest director ${name}: ${err instanceof Error ? err.message : String(err)}`
          result.errors.push(msg)
        }
      }
    }
  } catch (err) {
    const msg = `Failed to fetch directors for ${company.ticker}: ${err instanceof Error ? err.message : String(err)}`
    console.info(`[DirectorsIngestion] ${msg}`)
    result.errors.push(msg)
  }

  return result
}

/** Convert empty or whitespace-only strings to null. */
function emptyToNull(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
