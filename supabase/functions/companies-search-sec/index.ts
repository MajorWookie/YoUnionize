/**
 * SEC API company search with database upsert.
 *
 * Called by the Discover screen as a secondary search source when local DB
 * results are sparse (< 3). Queries SEC API for matching companies and
 * upserts them into the companies table for future local lookups.
 *
 * Returns the same shape as companies-search for easy merging on the frontend.
 */

import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import { companies } from '../_shared/schema.ts'
import { searchCompaniesSec } from '../_shared/sec-fetch.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors(req)

  try {
    const url = new URL(req.url)
    const query = url.searchParams.get('q')

    if (!query || query.trim().length < 1) {
      return jsonResponse({ results: [] })
    }

    const apiKey = Deno.env.get('SEC_API_KEY')
    if (!apiKey) {
      console.info('[companies-search-sec] SEC_API_KEY not set, returning empty')
      return jsonResponse({ results: [] })
    }

    const mappings = await searchCompaniesSec(apiKey, query.trim())
    if (mappings.length === 0) {
      return jsonResponse({ results: [] })
    }

    const db = getDb()
    const results: Array<{
      name: string
      ticker: string
      exchange: string | null
      sector: string | null
      industry: string | null
    }> = []

    // Upsert each found company and collect results
    for (const match of mappings) {
      const ticker = match.ticker as string | undefined
      const cik = match.cik as string | undefined

      // Skip incomplete mappings
      if (!ticker || !cik) continue

      try {
        const [record] = await db
          .insert(companies)
          .values({
            ticker: ticker as string,
            name: (match.name as string) ?? ticker,
            cik: cik as string,
            sector: (match.sector as string) ?? null,
            industry: (match.industry as string) ?? null,
            exchange: (match.exchange as string) ?? null,
          })
          .onConflictDoUpdate({
            target: companies.ticker,
            set: {
              name: (match.name as string) ?? ticker,
              cik: cik as string,
              sector: (match.sector as string) ?? null,
              industry: (match.industry as string) ?? null,
              exchange: (match.exchange as string) ?? null,
              updatedAt: new Date().toISOString(),
            },
          })
          .returning({
            name: companies.name,
            ticker: companies.ticker,
            exchange: companies.exchange,
            sector: companies.sector,
            industry: companies.industry,
          })

        results.push(record)
      } catch (err) {
        console.info(
          `[companies-search-sec] Upsert failed for ${ticker}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    return jsonResponse({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.info('[companies-search-sec] Error:', message)
    return jsonResponse({ results: [] })
  }
})
