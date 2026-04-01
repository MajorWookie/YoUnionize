import { lookupCompany } from '~/server/services/company-lookup'
import { ingestFilings } from '~/server/services/filing-ingestion'
import { ingestCompensation } from '~/server/services/compensation-ingestion'
import { ingestInsiderTrading } from '~/server/services/insider-trading-ingestion'
import { ingestDirectors } from '~/server/services/directors-ingestion'
import { enqueueJob } from '~/server/job-queue'
import { withLogging, badRequest, classifyError } from '~/server/api-utils'

const handlers = withLogging('/api/companies/[ticker]/ingest', {
  async POST(request: Request) {
    try {
      // Extract ticker from URL path: /api/companies/AAPL/ingest
      const url = new URL(request.url)
      const segments = url.pathname.split('/')
      // Path: /api/companies/[ticker]/ingest → segments: ['', 'api', 'companies', 'AAPL', 'ingest']
      const ticker = segments[segments.length - 2]

      if (!ticker || ticker.length === 0) {
        return badRequest('Ticker is required')
      }

      // Look up (and cache) the company first — this is fast
      const company = await lookupCompany(ticker)

      // Enqueue the full ingestion as a background job
      const jobId = enqueueJob(async () => {
        console.info(`[Ingest] Starting ingestion for ${company.ticker} (${company.name})`)

        const [filings, compensation, insiderTrading, boardDirectors] =
          await Promise.allSettled([
            ingestFilings(company),
            ingestCompensation(company),
            ingestInsiderTrading(company),
            ingestDirectors(company),
          ])

        const summary = {
          company: { ticker: company.ticker, name: company.name },
          filings:
            filings.status === 'fulfilled'
              ? filings.value
              : { error: filings.reason?.message },
          compensation:
            compensation.status === 'fulfilled'
              ? compensation.value
              : { error: compensation.reason?.message },
          insiderTrading:
            insiderTrading.status === 'fulfilled'
              ? insiderTrading.value
              : { error: insiderTrading.reason?.message },
          directors:
            boardDirectors.status === 'fulfilled'
              ? boardDirectors.value
              : { error: boardDirectors.reason?.message },
        }

        console.info(`[Ingest] Completed ingestion for ${company.ticker}:`, JSON.stringify(summary))
        return summary
      })

      return Response.json({
        jobId,
        company: { ticker: company.ticker, name: company.name, id: company.id },
        message: 'Ingestion started. Poll /api/jobs/{jobId} for status.',
      })
    } catch (err) {
      return classifyError(err)
    }
  },
})

export const POST = handlers.POST
