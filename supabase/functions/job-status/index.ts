import { eq } from 'drizzle-orm'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import { jobs } from '../_shared/schema.ts'
import { badRequest, notFound, classifyError } from '../_shared/api-utils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    const url = new URL(req.url)
    const jobId = url.searchParams.get('id')

    if (!jobId) return badRequest('id query parameter is required')

    const db = getDb()

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)

    if (!job) return notFound('Job not found')

    return jsonResponse({
      id: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      result: job.status === 'completed' ? job.result : undefined,
      error: job.status === 'failed' ? job.error : undefined,
    })
  } catch (err) {
    return classifyError(err)
  }
})
