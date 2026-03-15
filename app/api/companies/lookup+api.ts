import { lookupCompany } from '~/server/services/company-lookup'
import { withLogging, badRequest, classifyError } from '~/server/api-utils'

const handlers = withLogging('/api/companies/lookup', {
  async POST(request: Request) {
    try {
      const body = await request.json()
      const { ticker, name } = body as { ticker?: string; name?: string }

      const query = ticker ?? name
      if (!query || typeof query !== 'string') {
        return badRequest('Provide a "ticker" or "name" field')
      }

      const company = await lookupCompany(query)
      return Response.json({ company })
    } catch (err) {
      return classifyError(err)
    }
  },
})

export const POST = handlers.POST
