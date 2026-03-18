import { eq } from 'drizzle-orm'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import { companies } from '../_shared/schema.ts'
import { badRequest, classifyError } from '../_shared/api-utils.ts'

const SEC_API_BASE = 'https://api.sec-api.io'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    const body = await req.json()
    const { ticker, name } = body as { ticker?: string; name?: string }

    const query = ticker ?? name
    if (!query || typeof query !== 'string') {
      return badRequest('Provide a "ticker" or "name" field')
    }

    const company = await lookupCompany(query)
    return jsonResponse({ company })
  } catch (err) {
    return classifyError(err)
  }
})

async function lookupCompany(tickerOrName: string) {
  const apiKey = Deno.env.get('SEC_API_KEY')
  if (!apiKey) throw new Error('SEC_API_KEY is not set')

  const input = tickerOrName.trim().toUpperCase()

  // Try ticker first, fall back to name
  let mappings = await fetchMappings(apiKey, 'ticker', input)
  if (mappings.length === 0) {
    mappings = await fetchMappings(apiKey, 'name', tickerOrName.trim())
  }

  if (mappings.length === 0) {
    throw new Error(`No company found for "${tickerOrName}"`)
  }

  const match = mappings[0]
  if (!match.ticker || !match.cik) {
    throw new Error(`Incomplete data for "${tickerOrName}": missing ticker or CIK`)
  }

  const db = getDb()

  const [record] = await db
    .insert(companies)
    .values({
      ticker: match.ticker as string,
      name: match.name as string,
      cik: match.cik as string,
      sector: (match.sector as string) ?? null,
      industry: (match.industry as string) ?? null,
      exchange: (match.exchange as string) ?? null,
    })
    .onConflictDoUpdate({
      target: companies.ticker,
      set: {
        name: match.name as string,
        cik: match.cik as string,
        sector: (match.sector as string) ?? null,
        industry: (match.industry as string) ?? null,
        exchange: (match.exchange as string) ?? null,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning()

  return record
}

async function fetchMappings(
  apiKey: string,
  field: string,
  value: string,
): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(`${SEC_API_BASE}/mapping/company/${field}/${encodeURIComponent(value)}`, {
    headers: { Authorization: apiKey },
  })

  if (!res.ok) {
    if (res.status === 429) throw new Error('SEC API rate limit (429)')
    return []
  }

  const data = await res.json()
  return Array.isArray(data) ? data : []
}
