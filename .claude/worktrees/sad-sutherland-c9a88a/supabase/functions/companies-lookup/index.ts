import { eq, ilike } from 'drizzle-orm'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import { companies } from '../_shared/schema.ts'
import { badRequest, notFound, classifyError } from '../_shared/api-utils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors(req)

  try {
    const body = await req.json()
    const { ticker, name } = body as { ticker?: string; name?: string }

    const query = ticker ?? name
    if (!query || typeof query !== 'string') {
      return badRequest('Provide a "ticker" or "name" field')
    }

    const db = getDb()
    const input = query.trim().toUpperCase()

    // Look up by ticker in local DB
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.ticker, input))
      .limit(1)

    if (company) return jsonResponse({ company })

    // Fall back to name search in local DB
    const [byName] = await db
      .select()
      .from(companies)
      .where(ilike(companies.name, `%${query.trim()}%`))
      .limit(1)

    if (byName) return jsonResponse({ company: byName })

    return notFound(`No company found for "${query}"`)
  } catch (err) {
    return classifyError(err)
  }
})
