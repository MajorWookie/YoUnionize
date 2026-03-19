import { eq, desc, and, isNotNull, sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import {
  companies,
  filingSummaries,
  embeddings,
  userProfiles,
} from '../_shared/schema.ts'
import { badRequest, externalServiceError, classifyError } from '../_shared/api-utils.ts'

interface SourceCitation {
  filingId: string
  filingType: string
  section: string
  periodEnd: string | null
  companyTicker: string
  similarity: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    const body = await req.json()
    const { question, company_ticker: companyTicker } = body as {
      question: string
      company_ticker?: string
    }

    if (!question || question.trim().length < 3) {
      return badRequest('Question is too short (minimum 3 characters)')
    }

    const db = getDb()
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is not set')

    // Resolve company
    let companyId: string | undefined
    let companyName: string | undefined

    if (companyTicker) {
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.ticker, companyTicker.toUpperCase()))
        .limit(1)

      if (company) {
        companyId = company.id
        companyName = company.name
      }
    }

    // Step 1: Generate embedding for the question
    let queryEmbedding: Array<number> | null = null
    if (openaiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: question,
          }),
        })
        const data = await res.json()
        queryEmbedding = data.data?.[0]?.embedding ?? null
      } catch (err) {
        console.error('[ask] Embedding failed:', err instanceof Error ? err.message : String(err))
      }
    }

    // Step 2: Vector search
    let vectorResults: Array<{
      sourceId: string
      metadata: Record<string, unknown> | null
      similarity: number
    }> = []

    if (queryEmbedding) {
      const vectorStr = `[${queryEmbedding.join(',')}]`

      const conditions: string[] = [`source_type = 'filing_summary'`]
      if (companyId) conditions.push(`metadata->>'companyId' = '${companyId}'`)

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const results = await db.execute(sql.raw(`
        SELECT id, source_id, metadata,
          1 - (embedding <=> '${vectorStr}'::vector) AS similarity
        FROM embeddings
        ${whereClause}
        ORDER BY embedding <=> '${vectorStr}'::vector
        LIMIT 5
      `))

      vectorResults = (results as Array<Record<string, unknown>>).map((row) => ({
        sourceId: row.source_id as string,
        metadata: row.metadata as Record<string, unknown> | null,
        similarity: Number(row.similarity),
      }))
    }

    // Step 3: Retrieve context
    const contextChunks: Array<string> = []
    const sources: Array<SourceCitation> = []
    const seenFilings = new Set<string>()

    for (const result of vectorResults) {
      if (seenFilings.has(result.sourceId)) continue
      seenFilings.add(result.sourceId)

      const [filing] = await db
        .select({
          id: filingSummaries.id,
          filingType: filingSummaries.filingType,
          periodEnd: filingSummaries.periodEnd,
          aiSummary: filingSummaries.aiSummary,
        })
        .from(filingSummaries)
        .where(eq(filingSummaries.id, result.sourceId))
        .limit(1)

      if (!filing?.aiSummary) continue

      const metadata = result.metadata ?? {}
      const section = (metadata.section as string) ?? 'unknown'
      const ticker = (metadata.companyTicker as string) ?? companyTicker ?? ''
      const summary = filing.aiSummary as Record<string, unknown>
      const sectionContent = summary[section]

      if (sectionContent) {
        let text: string
        if (typeof sectionContent === 'string') {
          text = sectionContent
        } else if (typeof sectionContent === 'object' && sectionContent !== null) {
          const obj = sectionContent as Record<string, unknown>
          if (obj.executive_summary) {
            text = [obj.executive_summary, obj.plain_language_explanation, obj.employee_relevance]
              .filter(Boolean)
              .join('\n\n')
          } else if (obj.analysis) {
            text = obj.analysis as string
          } else {
            text = JSON.stringify(obj, null, 2)
          }
        } else {
          continue
        }

        contextChunks.push(
          `[${ticker} ${filing.filingType} — ${section}${filing.periodEnd ? ` (${filing.periodEnd})` : ''}]\n${text}`,
        )
        sources.push({
          filingId: filing.id,
          filingType: filing.filingType,
          section,
          periodEnd: filing.periodEnd,
          companyTicker: ticker,
          similarity: result.similarity,
        })
      }
    }

    // Step 3b: Fallback — direct text retrieval
    if (contextChunks.length === 0 && companyId) {
      const recentFilings = await db
        .select({
          id: filingSummaries.id,
          filingType: filingSummaries.filingType,
          periodEnd: filingSummaries.periodEnd,
          aiSummary: filingSummaries.aiSummary,
        })
        .from(filingSummaries)
        .where(and(eq(filingSummaries.companyId, companyId), isNotNull(filingSummaries.aiSummary)))
        .orderBy(desc(filingSummaries.filedAt))
        .limit(3)

      for (const filing of recentFilings) {
        const summary = filing.aiSummary as Record<string, unknown>
        for (const [section, content] of Object.entries(summary)) {
          if (typeof content === 'string' && content.length > 50) {
            contextChunks.push(
              `[${companyTicker ?? ''} ${filing.filingType} — ${section}${filing.periodEnd ? ` (${filing.periodEnd})` : ''}]\n${content}`,
            )
            sources.push({
              filingId: filing.id, filingType: filing.filingType, section,
              periodEnd: filing.periodEnd, companyTicker: companyTicker ?? '', similarity: 0,
            })
          }
          if (contextChunks.length >= 5) break
        }
        if (contextChunks.length >= 5) break
      }
    }

    // Step 4: User profile context (optional)
    let userContext = ''
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      const authHeader = req.headers.get('authorization')
      const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

      if (supabaseUrl && anonKey && accessToken) {
        const supabase = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { data } = await supabase.auth.getUser()
        if (data.user) {
          const [profile] = await db
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.userId, data.user.id))
            .limit(1)

          if (profile) {
            const parts: Array<string> = []
            if (profile.jobTitle) parts.push(`Job title: ${profile.jobTitle}`)
            if (profile.companyTicker) parts.push(`Employer: ${profile.companyTicker}`)
            if (profile.grossAnnualPay) {
              parts.push(`Annual pay: $${(profile.grossAnnualPay / 100).toLocaleString()}`)
            }
            if (parts.length > 0) userContext = `\n\n[User context]\n${parts.join('\n')}`
          }
        }
      }
    } catch {
      // Unauthenticated — fine
    }

    // Step 5: Call Claude RAG
    if (contextChunks.length === 0) {
      return jsonResponse({
        answer: companyTicker
          ? `I don't have any data for ${companyTicker} yet. Try loading the company's data from the Discover tab first.`
          : 'I need more context to answer your question. Try specifying a company ticker.',
        sources: [],
        hasData: false,
      })
    }

    const contextWithUser = contextChunks.map((c) => c + userContext)

    const client = new Anthropic({ apiKey: anthropicKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: `You are an SEC filings analyst. Answer questions about companies using ONLY the provided filing context. Cite your sources. If the context doesn't contain the answer, say so.`,
      messages: [{
        role: 'user',
        content: `Context from SEC filings:\n\n${contextWithUser.join('\n\n---\n\n')}\n\nQuestion: ${question}`,
      }],
    })

    const textContent = message.content.find((c) => c.type === 'text')

    return jsonResponse({
      answer: textContent?.text ?? '',
      sources: sources.map((s) => ({
        filingType: s.filingType, section: s.section, periodEnd: s.periodEnd,
        companyTicker: s.companyTicker, similarity: Math.round(s.similarity * 100) / 100,
      })),
      hasData: true,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    })
  } catch (err) {
    return classifyError(err)
  }
})
