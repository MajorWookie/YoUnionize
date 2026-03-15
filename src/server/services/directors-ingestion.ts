import { and, eq } from 'drizzle-orm'
import { getDb, directors } from '@union/postgres'
import { getSecApiClient } from '../sec-api-client'
import type { CompanyRecord } from './company-lookup'

interface DirectorsIngestionResult {
  ingested: number
  skipped: number
  errors: Array<string>
}

/**
 * Ingest directors and board members for a company.
 * Idempotent: skips directors already stored (by company + name).
 */
export async function ingestDirectors(
  company: CompanyRecord,
): Promise<DirectorsIngestionResult> {
  const client = getSecApiClient()
  const result: DirectorsIngestionResult = { ingested: 0, skipped: 0, errors: [] }

  try {
    const response = await client.searchDirectors({
      query: `ticker:${company.ticker}`,
      from: '0',
      size: '50',
      sort: [{ filedAt: { order: 'desc' } }],
    })

    const db = getDb()

    // Deduplicate by name (API may return same director across multiple filings)
    const seenNames = new Set<string>()

    for (const director of response.data) {
      const name = director.name ?? 'Unknown'
      if (seenNames.has(name)) continue
      seenNames.add(name)

      try {
        // Check for existing record
        const existing = await db
          .select({ id: directors.id })
          .from(directors)
          .where(
            and(
              eq(directors.companyId, company.id),
              eq(directors.name, name),
            ),
          )
          .limit(1)

        if (existing.length > 0) {
          result.skipped++
          continue
        }

        await db.insert(directors).values({
          companyId: company.id,
          name,
          title: director.position ?? 'Director',
          isIndependent: director.isIndependent ?? null,
          committees: director.committeeMemberships ?? null,
          tenureStart: director.dateFirstElected ?? null,
        })

        result.ingested++
      } catch (err) {
        const msg = `Failed to ingest director ${name}: ${err instanceof Error ? err.message : String(err)}`
        result.errors.push(msg)
      }
    }
  } catch (err) {
    const msg = `Failed to fetch directors for ${company.ticker}: ${err instanceof Error ? err.message : String(err)}`
    console.info(`[DirectorsIngestion] ${msg}`)
    result.errors.push(msg)
  }

  return result
}
