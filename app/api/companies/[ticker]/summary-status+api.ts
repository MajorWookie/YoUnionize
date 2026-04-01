import { getCompanyByTicker } from '~/server/services/company-lookup'
import { getSummaryStatus } from '~/server/services/summarization-pipeline'
import { withLogging, badRequest, notFound, classifyError } from '~/server/api-utils'

const handlers = withLogging('/api/companies/[ticker]/summary-status', {
  async GET(request: Request) {
    try {
      const url = new URL(request.url)
      const segments = url.pathname.split('/')
      const ticker = segments[segments.length - 2]

      if (!ticker || ticker.length === 0) {
        return badRequest('Ticker is required')
      }

      const company = await getCompanyByTicker(ticker.toUpperCase())
      if (!company) {
        return notFound(`No company found for ticker "${ticker}"`)
      }

      const status = await getSummaryStatus(company.id)

      return Response.json({
        company: { ticker: company.ticker, name: company.name },
        ...status,
      })
    } catch (err) {
      return classifyError(err)
    }
  },
})

export const GET = handlers.GET
