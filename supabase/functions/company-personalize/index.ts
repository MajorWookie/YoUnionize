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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors(req)

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
        humanSummary: filingSummaries.humanSummary,
      })
      .from(filingSummaries)
      .where(eq(filingSummaries.id, filingId))
      .limit(1)

    const summarySource = filing?.humanSummary ?? filing?.aiSummary
    if (!filing || !summarySource) return notFound('Filing summary not found')

    // Get company name
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, filing.companyId))
      .limit(1)

    const companyName = company?.name ?? 'this company'
    const summary = summarySource as Record<string, unknown>
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

    const systemPrompt = `You are explaining a company's SEC filing to a friend over coffee. They are smart but know nothing about finance. They asked: "So what's actually going on with this company?"

Your job is to take the key findings from the filing and translate them into a conversational, relatable explanation.

The user's profile information is provided — weave it into your explanation to make it personal:
- Compare company spending or revenue to their salary scale
- Relate industry trends to their specific role
- Connect company decisions to how it might affect someone in their position

Rules:
- Write 3-5 paragraphs, each 2-3 sentences
- Start with the single most important thing: is the company doing better or worse than before?
- Use analogies to everyday life
- Connect abstract numbers to real things relative to the user's pay
- End with a one-sentence "bottom line"
- No bullet points. No headers. Just clear, flowing prose.
- No financial jargon without an immediate plain-language definition
- Never give investment advice

Respond with plain text only. No JSON, no markdown formatting.`

    const profileParts: Array<string> = []
    if (profile.jobTitle) profileParts.push(`Job title: ${profile.jobTitle}`)
    if (profile.grossAnnualPay) {
      profileParts.push(`Annual pay: $${(profile.grossAnnualPay / 100).toLocaleString()}`)
    }

    const userPrompt = `Explain in plain language what's going on with ${companyName} based on their ${filing.filingType} filing.

Here is the filing summary to translate:
${companySummaryText}

Key numbers:
${keyNumbersText}

The person you're explaining this to has the following background — use it to make your explanation more relatable:
${profileParts.join('\n')}`

    const client = new Anthropic({ apiKey: anthropicKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: systemPrompt,
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
