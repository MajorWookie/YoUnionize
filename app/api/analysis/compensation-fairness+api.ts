import { eq, desc } from 'drizzle-orm'
import {
  getDb,
  userProfiles,
  userCostOfLiving,
  companies,
  executiveCompensation,
  filingSummaries,
  compensationAnalyses,
} from '@younionize/postgres'
import { ensureAuth } from '~/features/auth/server/ensureAuth'
import { getAiClient } from '~/server/ai-client'
import {
  withLogging,
  incompleteProfile,
  notFound,
  externalServiceError,
  classifyError,
} from '~/server/api-utils'

const handlers = withLogging('/api/analysis/compensation-fairness', {
  async POST(request: Request) {
    try {
      const session = await ensureAuth(request)
      const userId = session.user.id
      const db = getDb()

      // 1. Get user profile
      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1)

      if (!profile?.companyTicker) {
        return incompleteProfile('Set your company in Profile before running an analysis')
      }

      if (!profile.grossAnnualPay) {
        return incompleteProfile('Set your gross annual pay in Profile before running an analysis')
      }

      // 2. Get cost of living
      const [col] = await db
        .select()
        .from(userCostOfLiving)
        .where(eq(userCostOfLiving.userId, userId))
        .limit(1)

      // 3. Get company
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.ticker, profile.companyTicker.toUpperCase()))
        .limit(1)

      if (!company) {
        return notFound(`Company ${profile.companyTicker} not found. Ingest data first.`)
      }

      // 4. Get exec comp data
      const execCompData = await db
        .select()
        .from(executiveCompensation)
        .where(eq(executiveCompensation.companyId, company.id))
        .orderBy(desc(executiveCompensation.totalCompensation))
        .limit(10)

      // 5. Get latest filing summary for financial context
      const [latestFiling] = await db
        .select({
          aiSummary: filingSummaries.aiSummary,
          humanSummary: filingSummaries.humanSummary,
          filingType: filingSummaries.filingType,
        })
        .from(filingSummaries)
        .where(eq(filingSummaries.companyId, company.id))
        .orderBy(desc(filingSummaries.filedAt))
        .limit(1)

      // Build cost of living map (exclude timestamps and id)
      const costOfLivingData: Record<string, number | null> = col
        ? {
            rentMortgage: col.rentMortgage,
            internet: col.internet,
            mobilePhone: col.mobilePhone,
            utilities: col.utilities,
            studentLoans: col.studentLoans,
            consumerDebt: col.consumerDebt,
            carLoan: col.carLoan,
            groceries: col.groceries,
            gym: col.gym,
            entertainment: col.entertainment,
            clothing: col.clothing,
            savingsTarget: col.savingsTarget,
            other: col.other,
          }
        : {}

      // Build exec comp for AI
      const execCompForAi = execCompData.map((e) => ({
        name: e.executiveName,
        title: e.title,
        fiscalYear: e.fiscalYear,
        totalCompensation: e.totalCompensation,
        salary: e.salary,
        bonus: e.bonus,
        stockAwards: e.stockAwards,
        optionAwards: e.optionAwards,
        ceoPayRatio: e.ceoPayRatio,
      }))

      // Extract key financial data from AI summary if available
      const companyFinancials: Record<string, unknown> = {
        companyName: company.name,
        ticker: company.ticker,
        sector: company.sector,
        industry: company.industry,
      }

      const summarySource = latestFiling?.humanSummary ?? latestFiling?.aiSummary
      if (summarySource) {
        const summary = summarySource as Record<string, unknown>
        // Include key_numbers and executive_summary for context
        const execSummary = summary.executive_summary as Record<string, unknown> | undefined
        if (execSummary?.key_numbers) {
          companyFinancials.key_numbers = execSummary.key_numbers
        }
        if (execSummary?.employee_relevance) {
          companyFinancials.employee_relevance = execSummary.employee_relevance
        }
      }

      // 6. Call Claude
      let result
      try {
        const ai = getAiClient()
        result = await ai.generateCompensationAnalysis({
          execComp: execCompForAi,
          userPay: profile.grossAnnualPay,
          companyFinancials,
          costOfLiving: costOfLivingData,
          companyName: company.name,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return externalServiceError('AI', `Analysis generation failed: ${msg}`)
      }

      // 7. Store the analysis
      const [saved] = await db
        .insert(compensationAnalyses)
        .values({
          userId,
          analysisData: {
            ...result.data,
            companyTicker: company.ticker,
            companyName: company.name,
            userPay: profile.grossAnnualPay,
            jobTitle: profile.jobTitle,
            orgLevel: profile.orgLevelCode,
            tokenUsage: result.usage,
          },
        })
        .returning()

      return Response.json({
        analysis: saved,
        usage: result.usage,
      })
    } catch (err) {
      return classifyError(err)
    }
  },

  /** GET — return most recent analysis (and optionally history) */
  async GET(request: Request) {
    try {
      const session = await ensureAuth(request)
      const userId = session.user.id
      const db = getDb()

      const url = new URL(request.url)
      const limit = Math.min(Number(url.searchParams.get('limit') ?? '1'), 10)

      const analyses = await db
        .select()
        .from(compensationAnalyses)
        .where(eq(compensationAnalyses.userId, userId))
        .orderBy(desc(compensationAnalyses.createdAt))
        .limit(limit)

      return Response.json({
        analyses,
        latest: analyses[0] ?? null,
      })
    } catch (err) {
      return classifyError(err)
    }
  },
})

export const POST = handlers.POST
export const GET = handlers.GET
