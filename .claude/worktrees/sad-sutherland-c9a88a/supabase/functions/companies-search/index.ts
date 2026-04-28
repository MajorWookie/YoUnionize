import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import { companies } from '../_shared/schema.ts'
import { or, ilike } from 'drizzle-orm'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors(req)

  try {
    const url = new URL(req.url)
    const query = url.searchParams.get('q')

    if (!query || query.trim().length < 1) {
      return jsonResponse({ results: [] })
    }

    const trimmed = query.trim()
    const db = getDb()

    // Search local companies by ticker (exact-ish) or name (fuzzy)
    const rows = await db
      .select({
        name: companies.name,
        ticker: companies.ticker,
        exchange: companies.exchange,
        sector: companies.sector,
        industry: companies.industry,
      })
      .from(companies)
      .where(
        or(
          ilike(companies.ticker, `${trimmed}%`),
          ilike(companies.name, `%${trimmed}%`),
        ),
      )
      .limit(10)

    return jsonResponse({ results: rows })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[companies-search] Error:', message)
    return jsonResponse({ results: [] })
  }
})
