/**
 * Lightweight SEC API fetch helpers for Deno Edge Functions.
 *
 * These make raw fetch() calls to sec-api.io, following the same pattern
 * established in companies-lookup/index.ts. For the full Node/Bun ingestion
 * services, see src/server/services/directors-ingestion.ts and
 * compensation-ingestion.ts — keep column mappings in sync.
 */

const SEC_API_BASE = 'https://api.sec-api.io'

/** Retry a fetch once after 1s on 429. */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1000))
    return fetch(url, init)
  }
  return res
}

/**
 * Search for companies by name via SEC API mapping endpoint.
 * Returns an array of company mapping objects.
 */
export async function searchCompaniesSec(
  apiKey: string,
  query: string,
): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetchWithRetry(
      `${SEC_API_BASE}/mapping/company/name/${encodeURIComponent(query)}`,
      { headers: { Authorization: apiKey } },
    )

    if (!res.ok) return []

    const data = await res.json()
    return Array.isArray(data) ? data.slice(0, 10) : []
  } catch (err) {
    console.info(`[sec-fetch] searchCompaniesSec failed: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }
}

/**
 * Fetch directors from SEC API for a given ticker.
 * Returns deduped directors (latest filing wins per name).
 *
 * The API returns nested data: data[] → filing objects, each with directors[].
 * We iterate most-recent-first and keep the first occurrence of each name.
 */
export async function fetchDirectorsFromSec(
  apiKey: string,
  ticker: string,
  filingCount = 5,
): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetchWithRetry(`${SEC_API_BASE}/directors-and-board-members`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `ticker:${ticker}`,
        from: '0',
        size: String(filingCount),
        sort: [{ filedAt: { order: 'desc' } }],
      }),
    })

    if (!res.ok) return []

    const body = await res.json()
    const filings = Array.isArray(body?.data) ? body.data : []

    // Deduplicate by name across filings — first occurrence is most recent
    const seenNames = new Set<string>()
    const deduped: Array<Record<string, unknown>> = []

    for (const filing of filings) {
      const dirs = Array.isArray(filing?.directors) ? filing.directors : []
      for (const director of dirs) {
        const name = (director?.name as string) ?? 'Unknown'
        if (seenNames.has(name)) continue
        seenNames.add(name)
        deduped.push(director as Record<string, unknown>)
      }
    }

    return deduped
  } catch (err) {
    console.info(`[sec-fetch] fetchDirectorsFromSec failed for ${ticker}: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }
}

/**
 * Fetch executive compensation from SEC API for a given ticker.
 * Returns a flat array of compensation records.
 */
export async function fetchCompensationFromSec(
  apiKey: string,
  ticker: string,
): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetchWithRetry(
      `${SEC_API_BASE}/compensation/${encodeURIComponent(ticker)}?token=${apiKey}`,
      { headers: { Authorization: apiKey } },
    )

    if (!res.ok) return []

    const body = await res.json()
    // API may return { data: [...] } or just [...]
    if (Array.isArray(body)) return body
    if (Array.isArray(body?.data)) return body.data
    return []
  } catch (err) {
    console.info(`[sec-fetch] fetchCompensationFromSec failed for ${ticker}: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }
}
