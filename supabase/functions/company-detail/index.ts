import { eq, desc, and } from 'drizzle-orm'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import {
  companies,
  filingSummaries,
  executiveCompensation,
  insiderTrades,
  directors,
} from '../_shared/schema.ts'
import { badRequest, notFound, classifyError } from '../_shared/api-utils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors(req)

  try {
    const url = new URL(req.url)
    const ticker = url.searchParams.get('ticker')?.toUpperCase()
    const requestedYear = url.searchParams.get('fiscal_year')
      ? Number(url.searchParams.get('fiscal_year'))
      : null

    if (!ticker) return badRequest('ticker query parameter is required')

    const db = getDb()

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.ticker, ticker))
      .limit(1)

    if (!company) return notFound(`Company "${ticker}" not found`)

    // Get distinct fiscal years for this company's executive compensation
    const fiscalYearRows = await db
      .selectDistinct({ year: executiveCompensation.fiscalYear })
      .from(executiveCompensation)
      .where(eq(executiveCompensation.companyId, company.id))
      .orderBy(desc(executiveCompensation.fiscalYear))

    const availableFiscalYears = fiscalYearRows.map((r) => r.year)
    const selectedFiscalYear = (requestedYear != null && availableFiscalYears.includes(requestedYear))
      ? requestedYear
      : availableFiscalYears[0] ?? null

    const [filingsData, execCompData, tradesData, directorsData] = await Promise.all([
      db
        .select({
          id: filingSummaries.id,
          filingType: filingSummaries.filingType,
          periodEnd: filingSummaries.periodEnd,
          filedAt: filingSummaries.filedAt,
          accessionNumber: filingSummaries.accessionNumber,
          aiSummary: filingSummaries.aiSummary,
          humanSummary: filingSummaries.humanSummary,
          summaryVersion: filingSummaries.summaryVersion,
        })
        .from(filingSummaries)
        .where(eq(filingSummaries.companyId, company.id))
        .orderBy(desc(filingSummaries.filedAt)),

      // Filter executives by selected fiscal year (if available)
      selectedFiscalYear != null
        ? db
          .select()
          .from(executiveCompensation)
          .where(and(
            eq(executiveCompensation.companyId, company.id),
            eq(executiveCompensation.fiscalYear, selectedFiscalYear),
          ))
          .orderBy(desc(executiveCompensation.totalCompensation))
          .limit(20)
        : db
          .select()
          .from(executiveCompensation)
          .where(eq(executiveCompensation.companyId, company.id))
          .orderBy(desc(executiveCompensation.totalCompensation))
          .limit(20),

      db
        .select()
        .from(insiderTrades)
        .where(eq(insiderTrades.companyId, company.id))
        .orderBy(desc(insiderTrades.transactionDate))
        .limit(50),

      db
        .select()
        .from(directors)
        .where(eq(directors.companyId, company.id)),
    ])

    const hasSummary = (f: { aiSummary: unknown; humanSummary: unknown }) =>
      f.aiSummary != null || f.humanSummary != null
    const summaryOf = (f: { aiSummary: unknown; humanSummary: unknown }) =>
      f.humanSummary ?? f.aiSummary

    const latestAnnual = filingsData.find((f) => f.filingType === '10-K' && hasSummary(f))
    const latestQuarterly = filingsData.find((f) => f.filingType === '10-Q' && hasSummary(f))
    const latestProxy = filingsData.find((f) => f.filingType === 'DEF 14A' && hasSummary(f))
    const recentEvents = filingsData
      .filter((f) => f.filingType === '8-K' && hasSummary(f))
      .slice(0, 5)

    const totalFilings = filingsData.length
    const summarizedFilings = filingsData.filter(hasSummary).length

    return jsonResponse({
      company: {
        id: company.id,
        ticker: company.ticker,
        name: company.name,
        cik: company.cik,
        sector: company.sector,
        industry: company.industry,
        exchange: company.exchange,
      },
      status: {
        hasData: totalFilings > 0,
        totalFilings,
        summarizedFilings,
        pendingFilings: totalFilings - summarizedFilings,
      },
      latestAnnual: latestAnnual
        ? { id: latestAnnual.id, filingType: latestAnnual.filingType, periodEnd: latestAnnual.periodEnd, filedAt: latestAnnual.filedAt, summary: summaryOf(latestAnnual) }
        : null,
      latestQuarterly: latestQuarterly
        ? { id: latestQuarterly.id, filingType: latestQuarterly.filingType, periodEnd: latestQuarterly.periodEnd, filedAt: latestQuarterly.filedAt, summary: summaryOf(latestQuarterly) }
        : null,
      latestProxy: latestProxy
        ? { id: latestProxy.id, periodEnd: latestProxy.periodEnd, summary: summaryOf(latestProxy) }
        : null,
      recentEvents: recentEvents.map((e) => ({ id: e.id, filedAt: e.filedAt, summary: summaryOf(e) })),
      availableFiscalYears,
      selectedFiscalYear,
      executives: execCompData.map((e) => ({
        id: e.id, name: e.canonicalName ?? e.executiveName, title: e.title, fiscalYear: e.fiscalYear,
        totalCompensation: e.totalCompensation, salary: e.salary, bonus: e.bonus,
        stockAwards: e.stockAwards, optionAwards: e.optionAwards, ceoPayRatio: e.ceoPayRatio,
      })),
      insiderTrades: tradesData.map((t) => ({
        id: t.id, filerName: t.filerName, filerTitle: t.filerTitle,
        transactionDate: t.transactionDate, transactionType: t.transactionType,
        shares: t.shares, pricePerShare: t.pricePerShare, totalValue: t.totalValue,
      })),
      directors: directorsData.map((d) => ({
        id: d.id, name: d.canonicalName ?? d.name, title: d.title,
        isIndependent: d.isIndependent, committees: d.committees, tenureStart: d.tenureStart,
      })),
    })
  } catch (err) {
    return classifyError(err)
  }
})
