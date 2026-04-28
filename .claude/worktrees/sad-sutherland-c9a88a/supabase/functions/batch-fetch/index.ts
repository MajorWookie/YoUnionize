import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import { jobs } from '../_shared/schema.ts'
import { badRequest, classifyError } from '../_shared/api-utils.ts'

/**
 * Batch fetch Edge Function: Enqueue a fetch_batch job that creates
 * individual fetch jobs for multiple companies.
 *
 * Usage: POST /functions/v1/batch-fetch
 * Body: { "tickers": ["AAPL", "MSFT", "NVDA"] }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors(req)

  try {
    const body = await req.json()
    const { tickers } = body as { tickers?: Array<string> }

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return badRequest('Provide a "tickers" array with at least one ticker')
    }

    const normalizedTickers = tickers.map((t: string) => t.trim().toUpperCase())

    // Enqueue batch job
    const db = getDb()
    const [job] = await db
      .insert(jobs)
      .values({
        type: 'fetch_batch',
        payload: { tickers: normalizedTickers },
      })
      .returning({ id: jobs.id })

    return jsonResponse({
      jobId: job.id,
      tickers: normalizedTickers,
      count: normalizedTickers.length,
      message: 'Batch fetch enqueued. Poll /functions/v1/job-status?id={jobId} for status.',
    })
  } catch (err) {
    return classifyError(err)
  }
})
