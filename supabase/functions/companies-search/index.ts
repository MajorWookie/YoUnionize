import { handleCors, jsonResponse } from '../_shared/cors.ts'

const SEC_API_BASE = 'https://api.sec-api.io'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    const url = new URL(req.url)
    const query = url.searchParams.get('q')

    if (!query || query.trim().length < 1) {
      return jsonResponse({ results: [] })
    }

    const apiKey = Deno.env.get('SEC_API_KEY')
    if (!apiKey) throw new Error('SEC_API_KEY is not set')

    const trimmed = query.trim()

    // Try ticker mapping first, then name
    let mappings = await fetchMappings(apiKey, 'ticker', trimmed.toUpperCase())
    if (mappings.length === 0) {
      mappings = await fetchMappings(apiKey, 'name', trimmed)
    }

    const results = mappings.slice(0, 10).map((m: Record<string, unknown>) => ({
      name: m.name,
      ticker: m.ticker,
      exchange: m.exchange,
      sector: m.sector,
      industry: m.industry,
    }))

    return jsonResponse({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[companies-search] Degraded:', message)
    return jsonResponse({ results: [] })
  }
})

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
