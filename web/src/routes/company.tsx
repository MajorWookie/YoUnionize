import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { BarChart, DonutChart } from '@mantine/charts'
import { extractErrorMessage, fetchWithRetry } from '@younionize/api-client'
import { MarkdownContent } from '~/components/MarkdownContent'
import { TextSummaryCard } from '~/components/TextSummaryCard'
import { LeadershipSection } from '~/components/LeadershipSection'
import { CeoSpotlightCard } from '~/components/CeoSpotlightCard'
import type { Director, Executive } from '~/lib/exec-types'
import {
  InsiderTradingTable,
  type InsiderTrade,
} from '~/components/InsiderTradingTable'
import {
  RecentEventsList,
  type RecentEvent,
} from '~/components/RecentEventsList'
import { FinancialsSection } from '~/components/FinancialsSection'
import { IncomeStatementSunburst } from '~/components/IncomeStatementSunburst'
import {
  asEmployeeImpact,
  asString,
  formatEmployeeImpact,
} from '~/lib/summary-helpers'

interface CompanyInfo {
  id: string
  ticker: string
  name: string
  sector: string | null
  industry: string | null
  exchange: string | null
}

interface FilingSummary {
  id: string
  filingType: string
  periodEnd: string | null
  filedAt: string
  // Keyed by section name (executive_summary, employee_impact, etc.). Each
  // value is the structured *result object* from a Claude prompt, not a
  // string. Use extractRollupText() to pull the markdown body.
  summary: Record<string, unknown>
}

interface CompanyDetailResponse {
  company: CompanyInfo
  latestAnnual: FilingSummary | null
  executives: Array<Executive>
  directors: Array<Director>
  insiderTrades: Array<InsiderTrade>
  recentEvents: Array<RecentEvent>
  availableFiscalYears?: Array<number>
  selectedFiscalYear?: number | null
}

const fmtCompact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/)
  return parts[parts.length - 1] ?? full
}

/**
 * Pull a (headline, markdown) pair out of the executive_summary rollup.
 * V2 (CompanySummaryResult): { headline, company_health, ... }
 * V1 (FilingSummaryResult):  { executive_summary, plain_language_explanation, ... }
 * Discriminator from the Expo CompanySummaryCard: presence of `headline`.
 */
function extractRollupText(value: unknown): {
  headline?: string
  markdown?: string
} {
  if (!value || typeof value !== 'object') return {}
  const obj = value as Record<string, unknown>
  if (
    typeof obj.headline === 'string' &&
    typeof obj.company_health === 'string'
  ) {
    return { headline: obj.headline, markdown: obj.company_health }
  }
  if (typeof obj.executive_summary === 'string') {
    return { markdown: obj.executive_summary }
  }
  return {}
}

function buildCompBreakdown(exec: Executive) {
  return [
    { name: 'Salary', value: exec.salary ?? 0, color: 'navy.6' },
    { name: 'Bonus', value: exec.bonus ?? 0, color: 'green.5' },
    { name: 'Stock', value: exec.stockAwards ?? 0, color: 'navy.4' },
    { name: 'Options', value: exec.optionAwards ?? 0, color: 'navy.8' },
    {
      name: 'Other',
      value:
        (exec.otherCompensation ?? 0) + (exec.nonEquityIncentive ?? 0),
      color: 'slate.5',
    },
  ].filter((d) => d.value > 0)
}

export function CompanyPage() {
  const { ticker: tickerParam } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const ticker = tickerParam?.toUpperCase() ?? ''

  const [data, setData] = useState<CompanyDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // null = let the API pick the latest fiscal year. Once the API responds we
  // sync this from `selectedFiscalYear`; subsequent year switches refetch
  // with the explicit fiscal_year query param.
  const [fiscalYear, setFiscalYear] = useState<number | null>(null)

  useEffect(() => {
    if (!ticker) return
    let cancelled = false

    setLoading(true)
    setError(null)

    const yearParam = fiscalYear != null ? `?fiscal_year=${fiscalYear}` : ''
    fetchWithRetry(`/api/companies/${ticker}/detail${yearParam}`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          const errData = await res.json()
          setError(extractErrorMessage(errData))
          return
        }
        const detail = (await res.json()) as CompanyDetailResponse
        setData(detail)
        // Sync local fiscal year state with what the API selected so the
        // SegmentedControl shows the right pill on first load.
        if (
          detail.selectedFiscalYear != null &&
          detail.selectedFiscalYear !== fiscalYear
        ) {
          setFiscalYear(detail.selectedFiscalYear)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Network error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ticker, fiscalYear])

  if (loading) {
    return (
      <Center mih="60vh">
        <Stack gap="xs" align="center">
          <Loader />
          <Text c="slate.7">Loading {ticker}…</Text>
        </Stack>
      </Center>
    )
  }

  if (error || !data) {
    return (
      <Container size="md" py="xl">
        <Alert color="red" title="Could not load company">
          {error ?? 'No data returned for this ticker.'}
        </Alert>
        <Group mt="md">
          <Button variant="default" onClick={() => navigate('/discover')}>
            Back to discover
          </Button>
        </Group>
      </Container>
    )
  }

  const { company, latestAnnual, executives, directors, insiderTrades, recentEvents } = data
  const { headline, markdown: summaryText } = extractRollupText(
    latestAnnual?.summary.executive_summary,
  )

  const topExecs = executives
    .slice()
    .sort((a, b) => b.totalCompensation - a.totalCompensation)
    .slice(0, 5)

  const compBarData = topExecs.map((e) => ({
    name: lastName(e.name),
    Compensation: e.totalCompensation,
  }))

  const topExec = topExecs[0]
  const breakdownData = topExec ? buildCompBreakdown(topExec) : []

  // Text sections — every value lives on latestAnnual.summary keyed by
  // section name. Most prompts return strings; employee_impact returns a
  // structured object that we format into markdown for display.
  const summary = latestAnnual?.summary ?? {}
  const mdaText = asString(summary.mda)
  const riskFactorsText = asString(summary.risk_factors)
  const businessOverviewText = asString(summary.business_overview)
  const legalProceedingsText = asString(summary.legal_proceedings)
  const footnotesText = asString(summary.footnotes)
  const employeeImpact = asEmployeeImpact(summary.employee_impact)
  const employeeImpactText = employeeImpact
    ? formatEmployeeImpact(employeeImpact)
    : undefined

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Stack gap={4}>
          <Anchor onClick={() => navigate('/discover')} size="sm">
            ← Back to discover
          </Anchor>
          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Stack gap={4}>
              <Title order={1} c="navy.6">
                {company.name}
              </Title>
              <Group gap="xs">
                <Badge color="navy" variant="light">
                  {company.ticker}
                </Badge>
                {company.exchange && (
                  <Text size="sm" c="slate.7">
                    {company.exchange}
                  </Text>
                )}
                {company.sector && (
                  <Text size="sm" c="slate.7">
                    · {company.sector}
                    {company.industry ? ` · ${company.industry}` : ''}
                  </Text>
                )}
              </Group>
            </Stack>
          </Group>
        </Stack>

        {/* ── For You ─────────────────────────────────────────────
            Employee-relevant content lives here at the top. Even if you
            scroll no further, you should leave with a read on whether
            this company is a place worth working at. */}
        <Divider
          label="What this means for you"
          labelPosition="left"
          color="navy.4"
          styles={{ label: { color: 'var(--mantine-color-navy-7)', fontWeight: 600 } }}
        />
        <IncomeStatementSunburst
          summary={summary}
          periodEnd={latestAnnual?.periodEnd}
        />
        <TextSummaryCard
          title="What does this mean for employees?"
          content={employeeImpactText}
          maxHeight={360}
        />
        <CeoSpotlightCard executives={executives} ticker={company.ticker} />

        {/* ── Company snapshot ────────────────────────────────────
            High-level narrative: where the company stands, why it
            matters, and what could go wrong. */}
        <Divider label="Company snapshot" labelPosition="left" />
        {summaryText ? (
          <Card withBorder padding="lg" radius="md">
            <Title order={3} mb={headline ? 'xs' : 'sm'}>
              Executive Summary
            </Title>
            {headline && (
              <Text fw={600} size="md" c="navy.7" mb="sm">
                {headline}
              </Text>
            )}
            <MarkdownContent>{summaryText}</MarkdownContent>
          </Card>
        ) : (
          <Alert color="blue" variant="light" title="No summary yet">
            We haven't generated an AI summary for this company's latest
            annual filing yet.
          </Alert>
        )}
        <TextSummaryCard
          title="Risk Factors"
          content={riskFactorsText}
          maxHeight={280}
        />
        <TextSummaryCard
          title="Business Overview"
          content={businessOverviewText}
          maxHeight={240}
        />
        <TextSummaryCard
          title="Management Discussion & Analysis"
          content={mdaText}
          maxHeight={280}
        />

        {/* ── Recent news ─────────────────────────────────────────
            8-K events filed since the latest annual — material
            developments your prospective employer would expect you
            to know about. */}
        {recentEvents.length > 0 && (
          <>
            <Divider label="Recent news" labelPosition="left" />
            <RecentEventsList events={recentEvents} />
          </>
        )}

        {/* ── People ──────────────────────────────────────────────
            Who actually runs the place. Year selector lets you see
            comp for prior fiscal years too. */}
        <Divider label="People" labelPosition="left" />
        <LeadershipSection
          executives={executives}
          directors={directors}
          ticker={company.ticker}
          availableFiscalYears={data.availableFiscalYears}
          selectedFiscalYear={data.selectedFiscalYear}
          onFiscalYearChange={setFiscalYear}
        />

        {/* ── Financial health ────────────────────────────────────
            Detailed XBRL statements. The at-a-glance Income Breakdown
            sunburst lives up in the "What this means for you" group
            since revenue disposition is core context for employees;
            the tabs here drill into income, balance sheet, cash flow,
            and equity. */}
        <Divider label="Financial health" labelPosition="left" />
        <FinancialsSection summary={summary} />

        {/* ── Compensation deep-dive ──────────────────────────────
            Beyond the CEO spotlight: how do the top 5 named execs
            compare on total pay and pay mix? Mostly investor-relevant
            but useful color for the curious employee. */}
        <Divider label="Compensation deep-dive" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Card withBorder padding="lg" radius="md">
            <Stack gap="sm">
              <div>
                <Title order={4}>Top executive compensation</Title>
                <Text size="sm" c="slate.7">
                  Total comp for the {topExecs.length} highest-paid named
                  executives
                </Text>
              </div>
              {compBarData.length > 0 ? (
                <BarChart
                  h={260}
                  data={compBarData}
                  dataKey="name"
                  series={[{ name: 'Compensation', color: 'navy.6' }]}
                  valueFormatter={(v) => `$${fmtCompact.format(v)}`}
                  yAxisProps={{ width: 60, tickFormatter: (v) => `$${fmtCompact.format(Number(v))}` }}
                  withTooltip
                />
              ) : (
                <Text c="slate.7" size="sm">
                  No compensation data available.
                </Text>
              )}
            </Stack>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Stack gap="sm">
              <div>
                <Title order={4}>
                  {topExec ? `${topExec.name} pay mix` : 'Pay mix'}
                </Title>
                <Text size="sm" c="slate.7">
                  {topExec
                    ? `${topExec.title} · FY ${topExec.fiscalYear}`
                    : 'No executive selected'}
                </Text>
              </div>
              {breakdownData.length > 0 ? (
                <Center>
                  <DonutChart
                    data={breakdownData}
                    size={220}
                    thickness={32}
                    valueFormatter={(v) => `$${fmtCompact.format(v)}`}
                    withLabelsLine
                    withLabels
                    chartLabel={`$${fmtCompact.format(topExec?.totalCompensation ?? 0)}`}
                  />
                </Center>
              ) : (
                <Text c="slate.7" size="sm">
                  Compensation breakdown unavailable.
                </Text>
              )}
            </Stack>
          </Card>
        </SimpleGrid>

        {/* ── Other disclosures ───────────────────────────────────
            Lower-priority for employees: insider trading, lawsuits,
            footnotes. Still here for completeness, just not above
            the fold. */}
        {(insiderTrades.length > 0 ||
          legalProceedingsText ||
          footnotesText) && (
          <Divider label="Other disclosures" labelPosition="left" />
        )}
        <InsiderTradingTable trades={insiderTrades} />
        <TextSummaryCard
          title="Legal Proceedings"
          content={legalProceedingsText}
          maxHeight={200}
        />
        <TextSummaryCard
          title="Notable Footnotes"
          content={footnotesText}
          maxHeight={200}
        />
      </Stack>
    </Container>
  )
}
