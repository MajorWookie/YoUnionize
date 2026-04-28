import { eq } from 'drizzle-orm'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import { companies, jobs } from '../_shared/schema.ts'
import { badRequest, notFound, classifyError } from '../_shared/api-utils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors(req)

  try {
    const url = new URL(req.url)
    const ticker = url.searchParams.get('ticker')?.toUpperCase()

    if (!ticker) return badRequest('ticker query parameter is required')

    const db = getDb()

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.ticker, ticker))
      .limit(1)

    if (!company) return notFound(`Company "${ticker}" not found. Run ingestion first.`)

    // Enqueue summarization job
    const [job] = await db
      .insert(jobs)
      .values({
        type: 'summarize',
        payload: { ticker: company.ticker, companyId: company.id, companyName: company.name },
      })
      .returning({ id: jobs.id })

    // TODO: Trigger Lambda worker via AWS SDK or SQS
    // For now, the Lambda polls the jobs table for pending work

    return jsonResponse({
      jobId: job.id,
      company: { ticker: company.ticker, name: company.name, id: company.id },
      message: 'Summarization started. Poll /functions/v1/job-status?id={jobId} for status.',
    })
  } catch (err) {
    return classifyError(err)
  }
})
