import { getJob } from '~/server/job-queue'
import { withLogging, badRequest, notFound } from '~/server/api-utils'

const handlers = withLogging('/api/jobs/[jobId]', {
  GET(request: Request) {
    const url = new URL(request.url)
    const segments = url.pathname.split('/')
    const jobId = segments[segments.length - 1]

    if (!jobId) {
      return badRequest('Job ID is required')
    }

    const job = getJob(jobId)
    if (!job) {
      return notFound('Job not found')
    }

    return Response.json({
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      result: job.status === 'completed' ? job.result : undefined,
      error: job.status === 'failed' ? job.error : undefined,
    })
  },
})

export const GET = handlers.GET
