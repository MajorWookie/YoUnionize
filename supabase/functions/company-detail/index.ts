import { eq, desc, and, isNotNull } from 'drizzle-orm'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { getDb } from '../_shared/db.ts'
import {
  companies,
  filingSummaries,
  filingSections,
  executiveCompensation,
  insiderTrades,
  directors,
} from '../_shared/schema.ts'
import { badRequest, notFound, classifyError } from '../_shared/api-utils.ts'

/**
 * Per-item summaries (Risk Factors, MD&A, Business Overview, etc.) live
 * on filing_sections.ai_summary as of the 2026-04-29 per-section rewrite,
 * not on filing_summaries.ai_summary. The rollup blob now only contains
 * filing-level synthesis (executive_summary, employee_impact) plus
 * structured XBRL statements.
 *
 * To keep the API contract stable for the web app (which reads
 * `summary.mda`, `summary.risk_factors`, etc.), we merge the section
 * rows back into the `summary` shape server-side here. The prompt kind
 * is parsed from `prompt_id` (format: `<kind>@v<n>`) and used as the
 * key, with `financial_footnotes` mapped to `footnotes` to match the
 * legacy rollup-blob key the web expects.
 */
async function loadSectionRollup(
  db: ReturnType<typeof getDb>,
  filingId: string,
): Promise<Record<string, unknown>> {
  const rows = await db
    .select({
      promptId: filingSections.promptId,
      aiSummary: filingSections.aiSummary,
    })
    .from(filingSections)
    .where(
      and(
        eq(filingSections.filingId, filingId),
        isNotNull(filingSections.aiSummary),
      ),
    )

  const out: Record<string, unknown> = {}
  for (const row of rows) {
    const kind = (row.promptId ?? '').split('@')[0]
    if (!kind) continue
    // Web's summary-helpers expects `footnotes`; the prompt kind is
    // `financial_footnotes`. Map for backward compat.
    const key = kind === 'financial_footnotes' ? 'footnotes' : kind
    out[key] = row.aiSummary
  }
  return out
}

function mergeSummary(
  rollup: unknown,
  sections: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    rollup && typeof rollup === 'object'
      ? (rollup as Record<string, unknown>)
      : {}
  // Section content takes precedence over any stale rollup entry, since
  // post-2026-04-29 per-section rows are the source of truth for these
  // keys. Pre-2026-04-29 v1 rollups still carry mda/risk_factors/etc.,
  // but those will be overridden by section content as filings get
  // re-summarized under the new pipeline.
  return { ...base, ...sections }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

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

    const latestAnnual = filingsData.find((f) => f.filingType === '10-K' && f.aiSummary != null)
    const latestQuarterly = filingsData.find((f) => f.filingType === '10-Q' && f.aiSummary != null)
    const latestProxy = filingsData.find((f) => f.filingType === 'DEF 14A' && f.aiSummary != null)
    const recentEvents = filingsData
      .filter((f) => f.filingType === '8-K' && f.aiSummary != null)
      .slice(0, 5)

    // Per-item summaries (Risk Factors, MD&A, Business Overview, etc.)
    // live on filing_sections after the per-section rewrite; merge them
    // into the rollup-shaped `summary` field for each headline filing
    // so the web's existing `summary.<key>` reads keep working without
    // any client change.
    const [annualSections, quarterlySections, proxySections] = await Promise.all([
      latestAnnual ? loadSectionRollup(db, latestAnnual.id) : Promise.resolve({}),
      latestQuarterly ? loadSectionRollup(db, latestQuarterly.id) : Promise.resolve({}),
      latestProxy ? loadSectionRollup(db, latestProxy.id) : Promise.resolve({}),
    ])

    const totalFilings = filingsData.length
    const summarizedFilings = filingsData.filter((f) => f.aiSummary != null).length

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
        ? {
            id: latestAnnual.id,
            filingType: latestAnnual.filingType,
            periodEnd: latestAnnual.periodEnd,
            filedAt: latestAnnual.filedAt,
            summary: mergeSummary(latestAnnual.aiSummary, annualSections),
          }
        : null,
      latestQuarterly: latestQuarterly
        ? {
            id: latestQuarterly.id,
            filingType: latestQuarterly.filingType,
            periodEnd: latestQuarterly.periodEnd,
            filedAt: latestQuarterly.filedAt,
            summary: mergeSummary(latestQuarterly.aiSummary, quarterlySections),
          }
        : null,
      latestProxy: latestProxy
        ? {
            id: latestProxy.id,
            periodEnd: latestProxy.periodEnd,
            summary: mergeSummary(latestProxy.aiSummary, proxySections),
          }
        : null,
      recentEvents: recentEvents.map((e) => ({ id: e.id, filedAt: e.filedAt, summary: e.aiSummary })),
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
