import { eq, and, isNull, isNotNull } from 'drizzle-orm'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import { companies, filingSummaries } from '../_shared/schema.ts'
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

    if (!company) return notFound(`No company found for ticker "${ticker}"`)

    // Get summary status counts
    const allFilings = await db
      .select({
        id: filingSummaries.id,
        aiSummary: filingSummaries.aiSummary,
      })
      .from(filingSummaries)
      .where(eq(filingSummaries.companyId, company.id))

    const totalFilings = allFilings.length
    const summarizedFilings = allFilings.filter((f) => f.aiSummary != null).length
    const pendingFilings = totalFilings - summarizedFilings

    return jsonResponse({
      company: { ticker: company.ticker, name: company.name },
      totalFilings,
      summarizedFilings,
      pendingFilings,
    })
  } catch (err) {
    return classifyError(err)
  }
})
