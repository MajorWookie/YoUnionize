import { eq } from 'drizzle-orm'
import { getDb, companies } from '@union/postgres'
import { getSecApiClient } from '../sec-api-client'

export interface CompanyRecord {
  id: string
  ticker: string
  name: string
  cik: string
  sector: string | null
  industry: string | null
  exchange: string | null
}

/**
 * Look up a company by ticker or name via SEC API, upsert into the database,
 * and return the company record.
 */
export async function lookupCompany(tickerOrName: string): Promise<CompanyRecord> {
  const client = getSecApiClient()
  const input = tickerOrName.trim().toUpperCase()

  // Try ticker first, fall back to name search
  let mappings = await client.mappingByTicker(input)
  if (mappings.length === 0) {
    mappings = await client.mappingByName(tickerOrName.trim())
  }

  if (mappings.length === 0) {
    throw new Error(`No company found for "${tickerOrName}"`)
  }

  // Prefer an exact ticker match. SEC's mapping endpoint can return historical
  // or unrelated tickers (e.g. "VZ" → AVZAQ/Aviza Technology), and silently
  // taking mappings[0] turns a wrong-match into corrupted data.
  const match =
    mappings.find((m) => m.ticker?.toUpperCase() === input) ?? mappings[0]
  if (!match.ticker || !match.cik) {
    throw new Error(`Incomplete data for "${tickerOrName}": missing ticker or CIK`)
  }

  const db = getDb()

  // Upsert: insert or update on ticker conflict
  const [record] = await db
    .insert(companies)
    .values({
      ticker: match.ticker,
      name: match.name,
      cik: match.cik,
      sector: match.sector ?? null,
      industry: match.industry ?? null,
      exchange: match.exchange ?? null,
    })
    .onConflictDoUpdate({
      target: companies.ticker,
      set: {
        name: match.name,
        cik: match.cik,
        sector: match.sector ?? null,
        industry: match.industry ?? null,
        exchange: match.exchange ?? null,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning()

  return record
}

/** Get a company from the database by ticker. */
export async function getCompanyByTicker(ticker: string): Promise<CompanyRecord | undefined> {
  const db = getDb()
  const [record] = await db
    .select()
    .from(companies)
    .where(eq(companies.ticker, ticker.toUpperCase()))
    .limit(1)
  return record
}
