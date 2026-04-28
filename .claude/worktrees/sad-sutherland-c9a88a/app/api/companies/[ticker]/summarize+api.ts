import { lookupCompany } from '~/server/services/company-lookup'
import { summarizeCompanyFilings } from '~/server/services/summarization-pipeline'
import { enqueueJob } from '~/server/job-queue'
import { withLogging, badRequest, classifyError } from '~/server/api-utils'

const handlers = withLogging('/api/companies/[ticker]/summarize', {
  async POST(request: Request) {
    try {
      const url = new URL(request.url)
      const segments = url.pathname.split('/')
      const ticker = segments[segments.length - 2]

      if (!ticker || ticker.length === 0) {
        return badRequest('Ticker is required')
      }

      const company = await lookupCompany(ticker)

      const jobId = enqueueJob(async () => {
        console.info(`[Summarize] Starting summarization for ${company.ticker} (${company.name})`)
        const result = await summarizeCompanyFilings(company.id, company.name)
        console.info(
          `[Summarize] Completed for ${company.ticker}: ${result.summarized}/${result.total} filings`,
        )
        return result
      })

      return Response.json({
        jobId,
        company: { ticker: company.ticker, name: company.name, id: company.id },
        message: 'Summarization started. Poll /api/jobs/{jobId} for status.',
      })
    } catch (err) {
      return classifyError(err)
    }
  },
})

export const POST = handlers.POST
