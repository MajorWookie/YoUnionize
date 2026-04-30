import { eq, and } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { ensureAuth } from '../_shared/auth.ts'
import { getDb } from '../_shared/db.ts'
import {
  userProfiles,
  filingSummaries,
  companies,
  personalizedSummaries,
} from '../_shared/schema.ts'
import { badRequest, notFound, classifyError } from '../_shared/api-utils.ts'
import {
  whatThisMeansSystemPrompt,
  whatThisMeansUserPrompt,
} from '../_shared/prompts/what-this-means.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    const session = await ensureAuth(req)
    const userId = session.user.id
    const db = getDb()

    const body = await req.json()
    const { filing_id: filingId } = body as { filing_id: string }

    if (!filingId) return badRequest('filing_id is required')

    // Check cache first
    const [cached] = await db
      .select({ content: personalizedSummaries.content })
      .from(personalizedSummaries)
      .where(
        and(
          eq(personalizedSummaries.userId, userId),
          eq(personalizedSummaries.filingId, filingId),
        ),
      )
      .limit(1)

    if (cached) {
      return jsonResponse({ content: cached.content, cached: true })
    }

    // Get user profile
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)

    if (!profile?.grossAnnualPay) {
      return badRequest('Complete your profile (including salary) to get personalized insights')
    }

    // Get filing summary
    const [filing] = await db
      .select({
        id: filingSummaries.id,
        filingType: filingSummaries.filingType,
        companyId: filingSummaries.companyId,
        aiSummary: filingSummaries.aiSummary,
      })
      .from(filingSummaries)
      .where(eq(filingSummaries.id, filingId))
      .limit(1)

    if (!filing?.aiSummary) return notFound('Filing summary not found')

    // Get company name
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, filing.companyId))
      .limit(1)

    const companyName = company?.name ?? 'this company'
    const summary = filing.aiSummary as Record<string, unknown>
    const execSummary = summary.executive_summary as Record<string, unknown> | string | undefined

    // Build summary text for the prompt
    let companySummaryText: string
    let keyNumbersText: string

    if (typeof execSummary === 'object' && execSummary !== null) {
      // v2 CompanySummaryResult
      companySummaryText = [
        execSummary.headline,
        execSummary.company_health,
      ].filter(Boolean).join('\n\n')

      const keyNumbers = execSummary.key_numbers as Array<{ label: string; value: string; context: string }> | undefined
      keyNumbersText = keyNumbers
        ?.map((n) => `${n.label}: ${n.value} — ${n.context}`)
        .join('\n') ?? ''
    } else if (typeof execSummary === 'string') {
      // v1 FilingSummaryResult (the whole exec summary object was stored differently)
      companySummaryText = execSummary
      keyNumbersText = ''
    } else {
      return notFound('Filing has no executive summary')
    }

    // Generate personalized explanation
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is not set')

    const userPrompt = whatThisMeansUserPrompt({
      companyName,
      filingType: filing.filingType,
      companySummary: companySummaryText,
      keyNumbers: keyNumbersText,
      userJobTitle: profile.jobTitle ?? undefined,
      userAnnualPay: profile.grossAnnualPay ? profile.grossAnnualPay / 100 : undefined,
    })

    const client = new Anthropic({ apiKey: anthropicKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: whatThisMeansSystemPrompt(),
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textContent = message.content.find((c) => c.type === 'text')
    const content = textContent?.text ?? ''

    // Cache the result
    await db.insert(personalizedSummaries).values({
      userId,
      filingId,
      content,
    })

    return jsonResponse({
      content,
      cached: false,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    })
  } catch (err) {
    return classifyError(err)
  }
})
