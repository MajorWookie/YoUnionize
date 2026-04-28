import { eq } from 'drizzle-orm'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import { companies, jobs } from '../_shared/schema.ts'
import { badRequest, classifyError } from '../_shared/api-utils.ts'

/**
 * Phase 2 Edge Function: Enqueue a process job for a single company.
 * Transforms raw SEC responses into domain tables + runs AI summarization.
 *
 * Usage: POST /functions/v1/company-process?ticker=AAPL
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors(req)

  try {
    const url = new URL(req.url)
    const ticker = url.searchParams.get('ticker')?.toUpperCase()

    if (!ticker) return badRequest('ticker query parameter is required')

    // Look up company from database (must already exist from fetch phase)
    const db = getDb()
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.ticker, ticker))
      .limit(1)

    if (!company) {
      return badRequest(`Company "${ticker}" not found. Run company-fetch first.`)
    }

    // Enqueue process job
    const [job] = await db
      .insert(jobs)
      .values({
        type: 'process',
        payload: { ticker: company.ticker, companyId: company.id, companyName: company.name },
      })
      .returning({ id: jobs.id })

    return jsonResponse({
      jobId: job.id,
      company: { ticker: company.ticker, name: company.name, id: company.id },
      message: 'Processing started. Poll /functions/v1/job-status?id={jobId} for status.',
    })
  } catch (err) {
    return classifyError(err)
  }
})
