import { eq, desc, and, isNotNull } from 'drizzle-orm'
import {
  getDb,
  companies,
  filingSummaries,
  userProfiles,
  findSimilarEmbeddings,
} from '@union/postgres'
import { getAiClient } from '~/server/ai-client'
import { lookupCompany } from '~/server/services/company-lookup'
import {
  withLogging,
  badRequest,
  externalServiceError,
  classifyError,
} from '~/server/api-utils'

interface AskRequest {
  question: string
  company_ticker?: string
}

interface SourceCitation {
  filingId: string
  filingType: string
  section: string
  periodEnd: string | null
  companyTicker: string
  similarity: number
}

const handlers = withLogging('/api/ask', {
  async POST(request: Request) {
    try {
      const body = (await request.json()) as AskRequest
      const { question, company_ticker: companyTicker } = body

      if (!question || question.trim().length < 3) {
        return badRequest('Question is too short (minimum 3 characters)')
      }

      const ai = getAiClient()
      const db = getDb()

      // Resolve company if provided
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
        } else {
          // Try to look up and create
          try {
            const record = await lookupCompany(companyTicker)
            companyId = record.id
            companyName = record.name
          } catch {
            // Company not found — proceed without filter
          }
        }
      }

      // Step 1: Generate embedding for the question
      let queryEmbedding: Array<number> | null = null
      try {
        queryEmbedding = await ai.generateEmbedding({ text: question })
      } catch (err) {
        console.info(
          '[Ask] Embedding generation failed, falling back to direct search:',
          err instanceof Error ? err.message : String(err),
        )
      }

      // Step 2: Vector search for relevant chunks
      let vectorResults: Array<{
        sourceId: string
        metadata: Record<string, unknown> | null
        similarity: number
      }> = []

      if (queryEmbedding) {
        const searchResults = await findSimilarEmbeddings({
          queryEmbedding,
          limit: 5,
          filters: {
            ...(companyId ? { companyId } : {}),
            sourceType: 'filing_summary',
          },
        })
        vectorResults = searchResults
      }

      // Step 3: Retrieve full context for each result
      const contextChunks: Array<string> = []
      const sources: Array<SourceCitation> = []
      const seenFilings = new Set<string>()

      if (vectorResults.length > 0) {
        for (const result of vectorResults) {
          if (seenFilings.has(result.sourceId)) continue
          seenFilings.add(result.sourceId)

          const [filing] = await db
            .select({
              id: filingSummaries.id,
              filingType: filingSummaries.filingType,
              periodEnd: filingSummaries.periodEnd,
              aiSummary: filingSummaries.aiSummary,
              companyId: filingSummaries.companyId,
            })
            .from(filingSummaries)
            .where(eq(filingSummaries.id, result.sourceId))
            .limit(1)

          if (!filing?.aiSummary) continue

          const metadata = result.metadata ?? {}
          const section = (metadata.section as string) ?? 'unknown'
          const ticker = (metadata.companyTicker as string) ?? companyTicker ?? ''

          // Get the section content from the AI summary
          const summary = filing.aiSummary as Record<string, unknown>
          const sectionContent = summary[section]

          if (sectionContent) {
            let text: string
            if (typeof sectionContent === 'string') {
              text = sectionContent
            } else if (typeof sectionContent === 'object' && sectionContent !== null) {
              const obj = sectionContent as Record<string, unknown>
              // Handle FilingSummaryResult shape
              if (obj.executive_summary) {
                text = [
                  obj.executive_summary,
                  obj.plain_language_explanation,
                  obj.employee_relevance,
                ]
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
      }

      // Step 3b: Fallback — if no vector results, do direct text retrieval
      if (contextChunks.length === 0 && companyId) {
        const recentFilings = await db
          .select({
            id: filingSummaries.id,
            filingType: filingSummaries.filingType,
            periodEnd: filingSummaries.periodEnd,
            aiSummary: filingSummaries.aiSummary,
          })
          .from(filingSummaries)
          .where(
            and(
              eq(filingSummaries.companyId, companyId),
              isNotNull(filingSummaries.aiSummary),
            ),
          )
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
                filingId: filing.id,
                filingType: filing.filingType,
                section,
                periodEnd: filing.periodEnd,
                companyTicker: companyTicker ?? '',
                similarity: 0,
              })
            }
            if (contextChunks.length >= 5) break
          }
          if (contextChunks.length >= 5) break
        }
      }

      // Step 4: Add user profile context if authenticated
      let userContext = ''
      try {
        // Try to get user — this is optional, don't fail if unauthenticated
        const { createRequestClient } = await import('~/features/auth/server/supabase')
        const supabase = createRequestClient(request)
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
            if (parts.length > 0) {
              userContext = `\n\n[User context]\n${parts.join('\n')}`
            }
          }
        }
      } catch {
        // Unauthenticated request — that's fine
      }

      // Step 5: Call Claude RAG
      if (contextChunks.length === 0) {
        return Response.json({
          answer:
            companyTicker
              ? `I don't have any data for ${companyTicker} yet. Try loading the company's data from the Discover tab first.`
              : 'I need more context to answer your question. Try specifying a company ticker.',
          sources: [],
          hasData: false,
        })
      }

      const contextWithUser = contextChunks.map((c) => c + userContext)

      let response
      try {
        response = await ai.ragQuery({
          query: question,
          context: contextWithUser,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return externalServiceError('AI', `Failed to generate answer: ${msg}`)
      }

      return Response.json({
        answer: response.data,
        sources: sources.map((s) => ({
          filingType: s.filingType,
          section: s.section,
          periodEnd: s.periodEnd,
          companyTicker: s.companyTicker,
          similarity: Math.round(s.similarity * 100) / 100,
        })),
        hasData: true,
        usage: response.usage,
      })
    } catch (err) {
      return classifyError(err)
    }
  },
})

export const POST = handlers.POST
