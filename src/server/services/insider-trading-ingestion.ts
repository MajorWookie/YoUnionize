import { and, eq } from 'drizzle-orm'
import { getDb, insiderTrades } from '@union/postgres'
import { getSecApiClient } from '../sec-api-client'
import type { CompanyRecord } from './company-lookup'

interface InsiderTradingIngestionResult {
  ingested: number
  skipped: number
  errors: Array<string>
}

const TRANSACTION_CODE_MAP: Record<string, string> = {
  P: 'purchase',
  S: 'sale',
  A: 'grant',
  M: 'exercise',
  G: 'gift',
}

/**
 * Ingest insider trading data (Form 3/4/5) for the past 12 months.
 * Idempotent: uses accession number + transaction details to avoid duplicates.
 */
export async function ingestInsiderTrading(
  company: CompanyRecord,
): Promise<InsiderTradingIngestionResult> {
  const client = getSecApiClient()
  const result: InsiderTradingIngestionResult = { ingested: 0, skipped: 0, errors: [] }

  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0]

  try {
    const db = getDb()

    for await (const page of client.paginateInsiderTrading({
      query: `issuer.tradingSymbol:${company.ticker} AND filedAt:[${oneYearAgoStr} TO *]`,
      sort: [{ filedAt: { order: 'desc' } }],
    })) {
      for (const trade of page.transactions) {
        try {
          const ownerName = trade.reportingOwner?.name ?? 'Unknown'
          const ownerTitle = trade.reportingOwner?.officerTitle ?? null
          const transactions = trade.nonDerivativeTable?.transactions ?? []

          for (const tx of transactions) {
            const txDate = tx.transactionDate ?? trade.periodOfReport ?? ''
            if (!txDate) continue

            const txCode = tx.transactionCode ?? ''
            const transactionType = TRANSACTION_CODE_MAP[txCode] ?? 'other'
            const shares = String(tx.sharesTraded ?? 0)
            const pricePerShare = tx.pricePerShare != null ? String(tx.pricePerShare) : null
            const totalValue =
              tx.sharesTraded != null && tx.pricePerShare != null
                ? Math.round(tx.sharesTraded * tx.pricePerShare * 100)
                : null

            // Build a filing URL from the accession number
            const filingUrl = trade.accessionNo
              ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${company.cik}&type=4&dateb=&owner=include&count=40&search_text=&action=getcompany`
              : null

            // Dedup check: same company, filer, date, and shares
            const dupeCheck = await db
              .select({ id: insiderTrades.id })
              .from(insiderTrades)
              .where(
                and(
                  eq(insiderTrades.companyId, company.id),
                  eq(insiderTrades.filerName, ownerName),
                  eq(insiderTrades.transactionDate, txDate),
                  eq(insiderTrades.shares, shares),
                ),
              )
              .limit(1)

            if (dupeCheck.length > 0) {
              result.skipped++
              continue
            }

            await db.insert(insiderTrades).values({
              companyId: company.id,
              filerName: ownerName,
              filerTitle: ownerTitle,
              transactionDate: txDate,
              transactionType,
              shares,
              pricePerShare,
              totalValue,
              filingUrl,
            })

            result.ingested++
          }
        } catch (err) {
          const msg = `Failed to ingest trade ${trade.accessionNo}: ${err instanceof Error ? err.message : String(err)}`
          result.errors.push(msg)
        }
      }
    }
  } catch (err) {
    const msg = `Failed to fetch insider trades for ${company.ticker}: ${err instanceof Error ? err.message : String(err)}`
    console.info(`[InsiderTradingIngestion] ${msg}`)
    result.errors.push(msg)
  }

  return result
}
