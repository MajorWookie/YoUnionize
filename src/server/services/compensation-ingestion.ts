import { and, eq, sql } from 'drizzle-orm'
import { getDb, executiveCompensation } from '@union/postgres'
import { normalizeName } from '@union/helpers'
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
        const normalized = normalizeName(execName)

        await db.insert(executiveCompensation).values({
          companyId: company.id,
          fiscalYear,
          executiveName: execName,
          normalizedName: normalized,
          title: exec.position ?? 'Unknown',
          totalCompensation: exec.total ?? 0,
          salary: exec.salary ?? null,
          bonus: exec.bonus ?? null,
          stockAwards: exec.stockAwards ?? null,
          optionAwards: exec.optionAwards ?? null,
          nonEquityIncentive: exec.nonEquityIncentiveCompensation ?? null,
          otherCompensation: exec.otherCompensation ?? null,
          ceoPayRatio: exec.ceoPayRatio ?? null,
        }).onConflictDoUpdate({
          target: [executiveCompensation.companyId, executiveCompensation.normalizedName, executiveCompensation.fiscalYear],
          set: {
            title: sql`EXCLUDED.title`,
            totalCompensation: sql`EXCLUDED.total_compensation`,
            salary: sql`EXCLUDED.salary`,
            bonus: sql`EXCLUDED.bonus`,
            stockAwards: sql`EXCLUDED.stock_awards`,
            optionAwards: sql`EXCLUDED.option_awards`,
            nonEquityIncentive: sql`EXCLUDED.non_equity_incentive`,
            otherCompensation: sql`EXCLUDED.other_compensation`,
            ceoPayRatio: sql`EXCLUDED.ceo_pay_ratio`,
          },
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
