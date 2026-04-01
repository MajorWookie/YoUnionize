import { getSecApiClient } from '~/server/sec-api-client'
import { withLogging, classifyError } from '~/server/api-utils'

const handlers = withLogging('/api/companies/search', {
  async GET(request: Request) {
    try {
      const url = new URL(request.url)
      const query = url.searchParams.get('q')

      if (!query || query.trim().length < 1) {
        return Response.json({ results: [] })
      }

      const client = getSecApiClient()
      const trimmed = query.trim()

      // Try ticker first (fast), then fall back to name search
      let mappings = await client.mappingByTicker(trimmed.toUpperCase())
      if (mappings.length === 0) {
        mappings = await client.mappingByName(trimmed)
      }

      // Return top 10 results
      const results = mappings.slice(0, 10).map((m) => ({
        name: m.name,
        ticker: m.ticker,
        exchange: m.exchange,
        sector: m.sector,
        industry: m.industry,
      }))

      return Response.json({ results })
    } catch (err) {
      // Search should degrade gracefully — return empty results on error
      const message = err instanceof Error ? err.message : String(err)
      console.info('[API] Company search degraded:', message)
      return Response.json({ results: [] })
    }
  },
})

export const GET = handlers.GET
