import { eq, desc } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { ensureAuth } from '../_shared/auth.ts'
import { getDb } from '../_shared/db.ts'
import {
  userProfiles,
  userCostOfLiving,
  companies,
  executiveCompensation,
  filingSummaries,
  compensationAnalyses,
} from '../_shared/schema.ts'
import {
  incompleteProfile,
  notFound,
  externalServiceError,
  classifyError,
} from '../_shared/api-utils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    const session = await ensureAuth(req)
    const userId = session.user.id
    const db = getDb()

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const limit = Math.min(Number(url.searchParams.get('limit') ?? '1'), 10)

      const analyses = await db
        .select()
        .from(compensationAnalyses)
        .where(eq(compensationAnalyses.userId, userId))
        .orderBy(desc(compensationAnalyses.createdAt))
        .limit(limit)

      return jsonResponse({ analyses, latest: analyses[0] ?? null })
    }

    // POST — generate new analysis
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

    const [col] = await db
      .select()
      .from(userCostOfLiving)
      .where(eq(userCostOfLiving.userId, userId))
      .limit(1)

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.ticker, profile.companyTicker.toUpperCase()))
      .limit(1)

    if (!company) {
      return notFound(`Company ${profile.companyTicker} not found. Ingest data first.`)
    }

    const execCompData = await db
      .select()
      .from(executiveCompensation)
      .where(eq(executiveCompensation.companyId, company.id))
      .orderBy(desc(executiveCompensation.totalCompensation))
      .limit(10)

    const [latestFiling] = await db
      .select({ aiSummary: filingSummaries.aiSummary, filingType: filingSummaries.filingType })
      .from(filingSummaries)
      .where(eq(filingSummaries.companyId, company.id))
      .orderBy(desc(filingSummaries.filedAt))
      .limit(1)

    const costOfLivingData: Record<string, number | null> = col
      ? {
        rentMortgage: col.rentMortgage, internet: col.internet, mobilePhone: col.mobilePhone,
        utilities: col.utilities, studentLoans: col.studentLoans, consumerDebt: col.consumerDebt,
        carLoan: col.carLoan, groceries: col.groceries, gym: col.gym,
        entertainment: col.entertainment, clothing: col.clothing, savingsTarget: col.savingsTarget,
        other: col.other,
      }
      : {}

    const execCompForAi = execCompData.map((e) => ({
      name: e.executiveName, title: e.title, fiscalYear: e.fiscalYear,
      totalCompensation: e.totalCompensation, salary: e.salary, bonus: e.bonus,
      stockAwards: e.stockAwards, optionAwards: e.optionAwards, ceoPayRatio: e.ceoPayRatio,
    }))

    const companyFinancials: Record<string, unknown> = {
      companyName: company.name, ticker: company.ticker,
      sector: company.sector, industry: company.industry,
    }

    if (latestFiling?.aiSummary) {
      const summary = latestFiling.aiSummary as Record<string, unknown>
      const execSummary = summary.executive_summary as Record<string, unknown> | undefined
      if (execSummary?.key_numbers) companyFinancials.key_numbers = execSummary.key_numbers
      if (execSummary?.employee_relevance) companyFinancials.employee_relevance = execSummary.employee_relevance
    }

    // Call Claude
    let result
    try {
      const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

      const client = new Anthropic({ apiKey })
      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        system: `You are a compensation fairness analyst. Analyze the employee's pay relative to executive compensation at their company. Provide a JSON response with: fairness_score (1-10), summary, detailed_analysis, recommendations, and key_findings.`,
        messages: [{
          role: 'user',
          content: `Analyze compensation fairness:\n\nEmployee Pay: $${(profile.grossAnnualPay / 100).toLocaleString()}/year\nJob Title: ${profile.jobTitle ?? 'Not specified'}\n\nCompany: ${company.name} (${company.ticker})\nSector: ${company.sector ?? 'Unknown'}\n\nExecutive Compensation:\n${JSON.stringify(execCompForAi, null, 2)}\n\nCompany Financials:\n${JSON.stringify(companyFinancials, null, 2)}\n\nCost of Living:\n${JSON.stringify(costOfLivingData, null, 2)}`,
        }],
      })

      const textContent = message.content.find((c) => c.type === 'text')
      const analysisText = textContent?.text ?? ''

      let analysisData: unknown
      try {
        analysisData = JSON.parse(analysisText)
      } catch {
        analysisData = { raw_analysis: analysisText }
      }

      result = {
        data: analysisData,
        usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return externalServiceError('AI', `Analysis generation failed: ${msg}`)
    }

    const [saved] = await db
      .insert(compensationAnalyses)
      .values({
        userId,
        analysisData: {
          ...(result.data as Record<string, unknown>),
          companyTicker: company.ticker, companyName: company.name,
          userPay: profile.grossAnnualPay, jobTitle: profile.jobTitle,
          orgLevel: profile.orgLevelCode, tokenUsage: result.usage,
        },
      })
      .returning()

    return jsonResponse({ analysis: saved, usage: result.usage })
  } catch (err) {
    return classifyError(err)
  }
})
