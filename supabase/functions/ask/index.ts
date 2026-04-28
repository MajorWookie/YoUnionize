import { eq, desc, and, isNotNull, or, sql } from 'drizzle-orm'
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
import { badRequest, classifyError } from '../_shared/api-utils.ts'

interface SourceCitation {
  filingId: string
  filingType: string
  section: string
  periodEnd: string | null
  companyTicker: string
  similarity: number
}

/** Minimum cosine similarity to consider a vector result relevant */
const COSINE_SIMILARITY_THRESHOLD = 0.3
/** Number of initial vector candidates to retrieve before reranking */
const VECTOR_CANDIDATE_LIMIT = 20
/** Number of results after reranking */
const RERANK_TOP_K = 5
/** Minimum reranker relevance score to keep a result */
const RERANK_RELEVANCE_THRESHOLD = 0.1

const RAG_SYSTEM_PROMPT = `You are a helpful financial information assistant for Younionize, a platform that helps employees understand their company's SEC filings and compensation data.

You answer questions using ONLY the provided context from SEC filings and company data. If the context doesn't contain enough information to answer the question, say so honestly — never make up financial data.

Each source is labeled with the company ticker, filing type, section name, and period. Use these labels to cite your sources precisely.

Rules:
- Write at an 8th-grade reading level
- Define any financial terms in parentheses when first used
- Use specific numbers from the context when available
- Synthesize information across multiple sources to give a complete answer — don't just quote one source at a time
- If the question is about pay fairness, be balanced but honest
- Keep answers concise — 2-4 paragraphs max
- If multiple context sources conflict, note the discrepancy and prefer the most recent filing
- Always cite which filing or data source your answer comes from when possible
- If context from different time periods is available, note trends over time

Never give investment advice. You explain filings — you don't recommend buying or selling stock.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors(req)

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

    // Step 1: Generate embedding for the question via Voyage AI
    let queryEmbedding: Array<number> | null = null
    const voyageKey = Deno.env.get('VOYAGE_API_KEY')
    if (voyageKey) {
      try {
        const res = await fetch('https://api.voyageai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${voyageKey}`,
          },
          body: JSON.stringify({
            model: Deno.env.get('VOYAGE_EMBEDDING_MODEL') ?? 'voyage-4-lite',
            input: question,
            input_type: 'query',
            output_dimension: 1024,
          }),
        })
        const data = await res.json()
        queryEmbedding = data.data?.[0]?.embedding ?? null
      } catch (err) {
        console.info('[ask] Embedding failed:', err instanceof Error ? err.message : String(err))
      }
    }

    // Step 2: Vector search — retrieve wider candidate pool
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
        LIMIT ${VECTOR_CANDIDATE_LIMIT}
      `))

      vectorResults = (results as Array<Record<string, unknown>>)
        .map((row) => ({
          sourceId: row.source_id as string,
          metadata: row.metadata as Record<string, unknown> | null,
          similarity: Number(row.similarity),
        }))
        .filter((r) => r.similarity >= COSINE_SIMILARITY_THRESHOLD)
    }

    // Step 2.5: Rerank candidates with Voyage AI
    if (vectorResults.length > RERANK_TOP_K && voyageKey) {
      try {
        const candidateTexts: Array<string> = []
        const candidateIndices: Array<number> = []

        for (let i = 0; i < vectorResults.length; i++) {
          const result = vectorResults[i]
          const [filing] = await db
            .select({
              id: filingSummaries.id,
              aiSummary: filingSummaries.aiSummary,
              humanSummary: filingSummaries.humanSummary,
            })
            .from(filingSummaries)
            .where(eq(filingSummaries.id, result.sourceId))
            .limit(1)

          const summarySource = filing?.humanSummary ?? filing?.aiSummary
          if (!summarySource) continue

          const metadata = result.metadata ?? {}
          const section = (metadata.section as string) ?? 'unknown'
          const summary = summarySource as Record<string, unknown>
          const text = extractSectionText(summary[section])

          if (text.length > 0) {
            candidateTexts.push(text.slice(0, 2000))
            candidateIndices.push(i)
          }
        }

        if (candidateTexts.length > RERANK_TOP_K) {
          const rerankRes = await fetch('https://api.voyageai.com/v1/rerank', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${voyageKey}`,
            },
            body: JSON.stringify({
              model: 'rerank-2',
              query: question,
              documents: candidateTexts,
              top_k: RERANK_TOP_K,
            }),
          })

          if (rerankRes.ok) {
            const rerankData = await rerankRes.json() as {
              data: Array<{ index: number; relevance_score: number }>
            }

            vectorResults = rerankData.data
              .filter((r) => r.relevance_score > RERANK_RELEVANCE_THRESHOLD)
              .map((r) => {
                const originalIdx = candidateIndices[r.index]
                return {
                  sourceId: vectorResults[originalIdx].sourceId,
                  metadata: vectorResults[originalIdx].metadata,
                  similarity: r.relevance_score,
                }
              })

            console.info(`[ask] Reranked ${candidateTexts.length} candidates → ${vectorResults.length} results`)
          }
        }
      } catch (err) {
        console.info(`[ask] Reranking failed, using vector results: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Step 3: Retrieve context — dedup by filing+section (not just filing)
    const contextChunks: Array<string> = []
    const sources: Array<SourceCitation> = []
    const seenKeys = new Set<string>()

    for (const result of vectorResults) {
      const metadata = result.metadata ?? {}
      const section = (metadata.section as string) ?? 'unknown'
      const dedupKey = `${result.sourceId}:${section}`
      if (seenKeys.has(dedupKey)) continue
      seenKeys.add(dedupKey)

      const [filing] = await db
        .select({
          id: filingSummaries.id,
          filingType: filingSummaries.filingType,
          periodEnd: filingSummaries.periodEnd,
          aiSummary: filingSummaries.aiSummary,
          humanSummary: filingSummaries.humanSummary,
        })
        .from(filingSummaries)
        .where(eq(filingSummaries.id, result.sourceId))
        .limit(1)

      const summarySource = filing?.humanSummary ?? filing?.aiSummary
      if (!filing || !summarySource) continue

      const ticker = (metadata.companyTicker as string) ?? companyTicker ?? ''
      const summary = summarySource as Record<string, unknown>
      const text = extractSectionText(summary[section])

      if (text.length > 0) {
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

    // Step 3b: Fallback — direct text retrieval from recent filings
    if (contextChunks.length === 0 && companyId) {
      const recentFilings = await db
        .select({
          id: filingSummaries.id,
          filingType: filingSummaries.filingType,
          periodEnd: filingSummaries.periodEnd,
          aiSummary: filingSummaries.aiSummary,
          humanSummary: filingSummaries.humanSummary,
        })
        .from(filingSummaries)
        .where(
          and(
            eq(filingSummaries.companyId, companyId),
            or(
              isNotNull(filingSummaries.aiSummary),
              isNotNull(filingSummaries.humanSummary),
            ),
          ),
        )
        .orderBy(desc(filingSummaries.filedAt))
        .limit(3)

      for (const filing of recentFilings) {
        const summary = (filing.humanSummary ?? filing.aiSummary) as Record<string, unknown>
        for (const [section, content] of Object.entries(summary)) {
          const text = extractSectionText(content)
          if (text.length > 50) {
            contextChunks.push(
              `[${companyTicker ?? ''} ${filing.filingType} — ${section}${filing.periodEnd ? ` (${filing.periodEnd})` : ''}]\n${text}`,
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
      const key = Deno.env.get('SUPABASE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
      const authHeader = req.headers.get('authorization')
      const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

      if (supabaseUrl && key && accessToken) {
        const supabase = createClient(supabaseUrl, key, {
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
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: RAG_SYSTEM_PROMPT,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract readable text from an AI summary section value (handles multiple shapes). */
function extractSectionText(content: unknown): string {
  if (content == null) return ''

  if (typeof content === 'string') return content

  if (typeof content === 'object') {
    const obj = content as Record<string, unknown>

    // CompanySummaryResult (v2)
    if (obj.headline) {
      return [obj.headline, obj.company_health].filter(Boolean).join('\n\n')
    }

    // FilingSummaryResult (v1)
    if (obj.executive_summary) {
      return [obj.executive_summary, obj.plain_language_explanation, obj.employee_relevance]
        .filter(Boolean)
        .join('\n\n')
    }

    // EmployeeImpactResult
    if (obj.overall_outlook) {
      return [
        obj.overall_outlook, obj.job_security, obj.compensation_signals,
        obj.growth_opportunities, obj.workforce_geography, obj.h1b_and_visa_dependency,
      ]
        .filter(Boolean)
        .join('\n\n')
    }

    // ExecCompSummary
    if (obj.analysis) return obj.analysis as string

    return JSON.stringify(obj, null, 2)
  }

  return ''
}
