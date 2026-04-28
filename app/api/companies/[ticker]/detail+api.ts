import { eq, desc } from 'drizzle-orm'
import {
  getDb,
  companies,
  filingSummaries,
  executiveCompensation,
  insiderTrades,
  directors,
} from '@younionize/postgres'
import { withLogging, badRequest, notFound, classifyError } from '~/server/api-utils'

const handlers = withLogging('/api/companies/[ticker]/detail', {
  async GET(request: Request) {
    try {
      const url = new URL(request.url)
      const segments = url.pathname.split('/')
      const ticker = segments[segments.length - 2]?.toUpperCase()

      if (!ticker) {
        return badRequest('Ticker is required')
      }

      const db = getDb()

      // Get company
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.ticker, ticker))
        .limit(1)

      if (!company) {
        return notFound(`Company "${ticker}" not found`)
      }

      // Fetch all related data in parallel
      const [filingsData, execCompData, tradesData, directorsData] =
        await Promise.all([
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

          db
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

      // Find the most recent 10-K with a summary for the main dashboard
      const latestAnnual = filingsData.find(
        (f) => f.filingType === '10-K' && f.aiSummary != null,
      )

      // Find the most recent 10-Q with a summary
      const latestQuarterly = filingsData.find(
        (f) => f.filingType === '10-Q' && f.aiSummary != null,
      )

      // Find the most recent DEF 14A with a summary
      const latestProxy = filingsData.find(
        (f) => f.filingType === 'DEF 14A' && f.aiSummary != null,
      )

      // Recent 8-K events
      const recentEvents = filingsData
        .filter((f) => f.filingType === '8-K' && f.aiSummary != null)
        .slice(0, 5)

      // Summary stats
      const totalFilings = filingsData.length
      const summarizedFilings = filingsData.filter((f) => f.aiSummary != null).length

      return Response.json({
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
              summary: latestAnnual.aiSummary,
            }
          : null,
        latestQuarterly: latestQuarterly
          ? {
              id: latestQuarterly.id,
              filingType: latestQuarterly.filingType,
              periodEnd: latestQuarterly.periodEnd,
              filedAt: latestQuarterly.filedAt,
              summary: latestQuarterly.aiSummary,
            }
          : null,
        latestProxy: latestProxy
          ? {
              id: latestProxy.id,
              periodEnd: latestProxy.periodEnd,
              summary: latestProxy.aiSummary,
            }
          : null,
        recentEvents: recentEvents.map((e) => ({
          id: e.id,
          filedAt: e.filedAt,
          summary: e.aiSummary,
        })),
        executives: execCompData.map((e) => ({
          id: e.id,
          name: e.executiveName,
          title: e.title,
          fiscalYear: e.fiscalYear,
          totalCompensation: e.totalCompensation,
          salary: e.salary,
          bonus: e.bonus,
          stockAwards: e.stockAwards,
          optionAwards: e.optionAwards,
          ceoPayRatio: e.ceoPayRatio,
        })),
        insiderTrades: tradesData.map((t) => ({
          id: t.id,
          filerName: t.filerName,
          filerTitle: t.filerTitle,
          transactionDate: t.transactionDate,
          transactionType: t.transactionType,
          shares: t.shares,
          pricePerShare: t.pricePerShare,
          totalValue: t.totalValue,
        })),
        directors: directorsData.map((d) => ({
          id: d.id,
          name: d.name,
          title: d.title,
          isIndependent: d.isIndependent,
          committees: d.committees,
          tenureStart: d.tenureStart,
        })),
      })
    } catch (err) {
      return classifyError(err)
    }
  },
})

export const GET = handlers.GET
