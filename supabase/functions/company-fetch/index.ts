import { eq } from 'drizzle-orm'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import { companies, jobs } from '../_shared/schema.ts'
import { badRequest, classifyError } from '../_shared/api-utils.ts'

const SEC_API_BASE = 'https://api.sec-api.io'

/**
 * Phase 1 Edge Function: Enqueue a fetch job for a single company.
 * Fetches ALL SEC data and stores raw responses (no LLM processing).
 *
 * Usage: POST /functions/v1/company-fetch?ticker=AAPL
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    const url = new URL(req.url)
    const ticker = url.searchParams.get('ticker')?.toUpperCase()

    if (!ticker) return badRequest('ticker query parameter is required')

    const apiKey = Deno.env.get('SEC_API_KEY')
    if (!apiKey) throw new Error('SEC_API_KEY is not set')

    // Look up company via SEC API and upsert
    const company = await lookupCompany(apiKey, ticker)

    // Enqueue fetch job
    const db = getDb()
    const [job] = await db
      .insert(jobs)
      .values({
        type: 'fetch',
        payload: { ticker: company.ticker, companyId: company.id, companyName: company.name },
      })
      .returning({ id: jobs.id })

    return jsonResponse({
      jobId: job.id,
      company: { ticker: company.ticker, name: company.name, id: company.id },
      message: 'Fetch started. Poll /functions/v1/job-status?id={jobId} for status.',
    })
  } catch (err) {
    return classifyError(err)
  }
})

async function lookupCompany(apiKey: string, ticker: string) {
  const res = await fetch(`${SEC_API_BASE}/mapping/company/ticker/${encodeURIComponent(ticker)}`, {
    headers: { Authorization: apiKey },
  })
  if (!res.ok) throw new Error(`SEC API lookup failed: ${res.status}`)

  const data = await res.json()
  const mappings = Array.isArray(data) ? data : []
  if (mappings.length === 0) throw new Error(`No company found for "${ticker}"`)

  const match = mappings[0]
  if (!match.ticker || !match.cik) throw new Error(`Incomplete data for "${ticker}"`)

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
