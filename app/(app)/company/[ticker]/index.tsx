import { useState, useEffect, useCallback } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Button, Paragraph, Separator, YStack } from 'tamagui'
import { ScreenContainer } from '~/interface/layout/ScreenContainer'
import { CompanyHeader } from '~/interface/layout/CompanyHeader'
import { LoadingState } from '~/interface/display/LoadingState'
import { ErrorState } from '~/interface/display/ErrorState'
import { extractErrorMessage, fetchWithRetry } from '~/lib/api-client'
import { CompanySummaryCard } from '~/features/company/sections/CompanySummaryCard'
import { LeadershipSection } from '~/features/company/sections/LeadershipSection'
import { FinancialsSection } from '~/features/company/sections/FinancialsSection'
import { TextSummaryCard } from '~/features/company/sections/TextSummaryCard'
import { RiskFactorsCard } from '~/features/company/sections/RiskFactorsCard'
import { InsiderTradingSection } from '~/features/company/sections/InsiderTradingSection'
import { IncomeStatementSunburst } from '~/features/company/sections/IncomeStatementSunburst'
import { CeoSpotlightCard } from '~/features/company/sections/CeoSpotlightCard'
import { IngestionPrompt } from '~/features/company/sections/IngestionPrompt'
import { AskBar } from '~/features/ask/AskBar'
import type {
  CompanyDetailResponse,
  FilingSummaryResult,
  ExecCompSummary,
} from '~/features/company/types'

export default function CompanyDetailScreen() {
  const params = useLocalSearchParams<{ ticker: string }>()
  const router = useRouter()
  const ticker = params.ticker?.toUpperCase() ?? ''

  const [data, setData] = useState<CompanyDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!ticker) return
    setLoading(true)
    setError(null)

    try {
      // Fetch company detail directly from DB (company must already exist from search)
      const res = await fetchWithRetry(`/api/companies/${ticker}/detail`)
      if (!res.ok) {
        const errData = await res.json()
        setError(extractErrorMessage(errData))
        setLoading(false)
        return
      }

      const detail = await res.json()
      setData(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [ticker])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState message={`Loading ${ticker}...`} />
      </ScreenContainer>
    )
  }

  if (error || !data) {
    return (
      <ScreenContainer>
        <ErrorState
          message={error ?? 'Failed to load company'}
          onRetry={fetchDetail}
        />
      </ScreenContainer>
    )
  }

  const { company, status } = data

  // Extract data from the most recent annual filing summary
  const annualSummary = data.latestAnnual?.summary as Record<string, unknown> | undefined
  const execSummary = annualSummary?.executive_summary as FilingSummaryResult | undefined
  const execCompSummary = (data.latestProxy?.summary as Record<string, unknown>)
    ?.executive_compensation as ExecCompSummary | undefined

  return (
    <ScreenContainer>
      {/* Back button */}
      <Button
        size="$2"
        variant="outlined"
        onPress={() => router.back()}
        self="flex-start"
        mb="$2"
      >
        {'\u2190'} Back
      </Button>

      {/* Company header */}
      <CompanyHeader
        name={company.name}
        ticker={company.ticker}
        sector={company.sector}
      />

      {company.industry && (
        <Paragraph color="$color8" fontSize={13} mb="$3">
          {company.industry}
          {company.exchange ? ` · ${company.exchange}` : ''}
        </Paragraph>
      )}

      {/* If no data has been ingested yet, show the load button */}
      {!status.hasData ? (
        <IngestionPrompt ticker={ticker} onComplete={fetchDetail} />
      ) : status.pendingFilings > 0 && status.summarizedFilings === 0 ? (
        // Data ingested but no summaries yet
        <IngestionPrompt ticker={ticker} onComplete={fetchDetail} />
      ) : (
        <CompanyDashboard data={data} />
      )}
    </ScreenContainer>
  )
}

function CompanyDashboard({ data }: { data: CompanyDetailResponse }) {
  const annualSummary = data.latestAnnual?.summary as Record<string, unknown> | undefined
  const quarterlySummary = data.latestQuarterly?.summary as Record<string, unknown> | undefined
  const proxySummary = data.latestProxy?.summary as Record<string, unknown> | undefined

  // Use the most detailed filing summary available (prefer annual)
  const primarySummary = annualSummary ?? quarterlySummary
  const execSummaryData = primarySummary?.executive_summary as FilingSummaryResult | undefined

  // Financial statements come from the most recent filing with XBRL data
  const financialSource = annualSummary ?? quarterlySummary
  const execCompSummary = proxySummary?.executive_compensation as ExecCompSummary | undefined

  return (
    <YStack gap="$4" pb="$6">
      {/* Ask bar */}
      <AskBar
        companyTicker={data.company.ticker}
        placeholder={`Ask about ${data.company.name}...`}
      />

      {/* Income Statement sunburst chart */}
      {financialSource && <IncomeStatementSunburst summary={financialSource} />}

      {/* CEO Spotlight */}
      <CeoSpotlightCard executives={data.executives} execCompSummary={execCompSummary} />

      <Separator />

      {/* a. Company Summary */}
      {execSummaryData && (
        <CompanySummaryCard
          summary={execSummaryData}
          periodEnd={data.latestAnnual?.periodEnd ?? data.latestQuarterly?.periodEnd ?? null}
          filingType={data.latestAnnual?.filingType ?? data.latestQuarterly?.filingType ?? ''}
        />
      )}

      <Separator />

      {/* b. Leadership */}
      <LeadershipSection executives={data.executives} directors={data.directors} companyTicker={data.company.ticker} />

      <Separator />

      {/* c. Financials */}
      {financialSource && <FinancialsSection summary={financialSource} />}

      <Separator />

      {/* d. MD&A */}
      {primarySummary?.mda && (
        <TextSummaryCard
          title="Management Discussion & Analysis"
          content={primarySummary.mda as string}
          previewLines={8}
          markdown
        />
      )}

      {/* e. Risk Factors */}
      {execSummaryData && (
        <RiskFactorsCard
          riskFactorsSummary={primarySummary?.risk_factors as string | undefined}
          redFlags={execSummaryData.red_flags}
          opportunities={execSummaryData.opportunities}
          execCompSummary={execCompSummary}
        />
      )}

      {/* f. Business Overview */}
      {primarySummary?.business_overview && (
        <TextSummaryCard
          title="Business Overview"
          content={primarySummary.business_overview as string}
          previewLines={6}
        />
      )}

      <Separator />

      {/* g. Insider Trading */}
      <InsiderTradingSection trades={data.insiderTrades} />

      {/* h. Legal & Footnotes */}
      {primarySummary?.legal_proceedings && (
        <TextSummaryCard
          title="Legal Proceedings"
          content={primarySummary.legal_proceedings as string}
          previewLines={4}
          markdown
        />
      )}
      {primarySummary?.footnotes && (
        <TextSummaryCard
          title="Notable Footnotes"
          content={primarySummary.footnotes as string}
          previewLines={4}
        />
      )}

      {/* Recent 8-K events */}
      {data.recentEvents.length > 0 && (
        <YStack gap="$3">
          <Paragraph fontWeight="700" fontSize={16}>
            Recent Events
          </Paragraph>
          {data.recentEvents.map((event) => {
            const eventSummary = event.summary as Record<string, unknown> | undefined
            return (
              <TextSummaryCard
                key={event.id}
                title={`8-K · ${new Date(event.filedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                content={eventSummary?.event_summary as string | undefined}
                previewLines={3}
                markdown
              />
            )
          })}
        </YStack>
      )}

      {/* Pending summary notice */}
      {data.status.pendingFilings > 0 && (
        <Paragraph color="$color8" fontSize={12} text="center">
          {data.status.pendingFilings} filing{data.status.pendingFilings !== 1 ? 's' : ''} still
          being analyzed...
        </Paragraph>
      )}
    </YStack>
  )
}
