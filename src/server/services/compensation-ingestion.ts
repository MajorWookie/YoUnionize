import { and, eq } from 'drizzle-orm'
import { getDb, executiveCompensation } from '@union/postgres'
import { getSecApiClient } from '../sec-api-client'
import type { CompanyRecord } from './company-lookup'

interface CompensationIngestionResult {
  ingested: number
  skipped: number
  errors: Array<string>
}

/**
 * Ingest executive compensation data for a company.
 * Idempotent: skips records that already exist (by company + executive + fiscal year).
 */
export async function ingestCompensation(
  company: CompanyRecord,
): Promise<CompensationIngestionResult> {
  const client = getSecApiClient()
  const result: CompensationIngestionResult = { ingested: 0, skipped: 0, errors: [] }

  try {
    const response = await client.getCompensationByTicker(company.ticker)
    const db = getDb()

    for (const exec of response.data) {
      try {
        const fiscalYear = exec.year ?? 0
        const execName = exec.name ?? 'Unknown'

        // Check for existing record (idempotency)
        const existing = await db
          .select({ id: executiveCompensation.id })
          .from(executiveCompensation)
          .where(
            and(
              eq(executiveCompensation.companyId, company.id),
              eq(executiveCompensation.executiveName, execName),
              eq(executiveCompensation.fiscalYear, fiscalYear),
            ),
          )
          .limit(1)

        if (existing.length > 0) {
          result.skipped++
          continue
        }

        await db.insert(executiveCompensation).values({
          companyId: company.id,
          fiscalYear,
          executiveName: execName,
          title: exec.position ?? 'Unknown',
          totalCompensation: exec.total ?? 0,
          salary: exec.salary ?? null,
          bonus: exec.bonus ?? null,
          stockAwards: exec.stockAwards ?? null,
          optionAwards: exec.optionAwards ?? null,
          nonEquityIncentive: exec.nonEquityIncentiveCompensation ?? null,
          otherCompensation: exec.otherCompensation ?? null,
          ceoPayRatio: exec.ceoPayRatio ?? null,
        })

        result.ingested++
      } catch (err) {
        const msg = `Failed to ingest comp for ${exec.name}: ${err instanceof Error ? err.message : String(err)}`
        result.errors.push(msg)
      }
    }
  } catch (err) {
    const msg = `Failed to fetch compensation for ${company.ticker}: ${err instanceof Error ? err.message : String(err)}`
    console.info(`[CompensationIngestion] ${msg}`)
    result.errors.push(msg)
  }

  return result
}
