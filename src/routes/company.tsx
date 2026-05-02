import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Container,
  Grid,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { BarChart, DonutChart } from '@mantine/charts'
import { extractErrorMessage, fetchWithRetry } from '@younionize/api-client'
import { AskBar } from '~/components/AskBar'
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
  Eyebrow,
  MetricCard,
  PageHeader,
  SectionHeader,
} from '~/components/primitives'
import { formatDollarsCompact } from '~/lib/format'
import { metricDelta } from '~/lib/metric-delta'
import { resolveTaxes, type ResolvedTaxes } from '~/lib/tax-metric'
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

interface IncomeStatementMetric {
  value: number
  changePercent: number | null
  period: string | null
}

const SERIF_HEADLINE: React.CSSProperties = {
  fontFamily: '"Source Serif 4 Variable", Charter, Georgia, serif',
}

const fmtCompact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const CEO_TITLE_PATTERN = /\b(chief\s+executive\s+officer|ceo)\b/i

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/)
  return parts[parts.length - 1] ?? full
}

/**
 * Pull a (headline, markdown) pair out of the executive_summary rollup.
 * V2 (CompanySummaryResult): { headline, company_health, ... }
 * V1 (FilingSummaryResult):  { executive_summary, plain_language_explanation, ... }
 * Discriminator: presence of `headline`.
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

/** First markdown paragraph (split on double newline) so the hero card
 *  shows a readable lead without dumping the full company-health blob. */
function firstParagraph(text: string): string {
  if (!text) return ''
  const trimmed = text.trim()
  const idx = trimmed.indexOf('\n\n')
  return idx === -1 ? trimmed : trimmed.slice(0, idx)
}

/** Scan an income statement for a line item matching `pattern`. Returns
 *  the current value, change percent, and period label — enough to drive
 *  a MetricCard with a delta. */
function findIncomeStatementMetric(
  summary: Record<string, unknown>,
  pattern: RegExp,
): IncomeStatementMetric | null {
  const stmt = summary.income_statement
  if (!stmt || typeof stmt !== 'object') return null
  const obj = stmt as {
    items?: Array<{
      label: string
      current: number | null
      changePercent: number | null
    }>
    periodCurrent?: string | null
  }
  if (!Array.isArray(obj.items)) return null
  const match = obj.items.find((i) => pattern.test(i.label))
  if (!match || match.current == null) return null
  return {
    value: match.current,
    changePercent: match.changePercent,
    period: obj.periodCurrent ?? null,
  }
}

function findCeo(execs: Array<Executive>): Executive | null {
  if (execs.length === 0) return null
  const byTitle = execs.find((e) => CEO_TITLE_PATTERN.test(e.title))
  if (byTitle) return byTitle
  return execs
    .slice()
    .sort((a, b) => b.totalCompensation - a.totalCompensation)[0] ?? null
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
          <Text c="dimmed">Loading {ticker}…</Text>
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

  const {
    company,
    latestAnnual,
    executives,
    directors,
    insiderTrades,
    recentEvents,
  } = data
  const { headline, markdown: summaryText } = extractRollupText(
    latestAnnual?.summary.executive_summary,
  )

  const summary = latestAnnual?.summary ?? {}

  // Narrative sections — extracted via the summary helpers.
  const mdaText = asString(summary.mda)
  const riskFactorsText = asString(summary.risk_factors)
  const businessOverviewText = asString(summary.business_overview)
  const legalProceedingsText = asString(summary.legal_proceedings)
  const footnotesText = asString(summary.footnotes)
  const employeeImpact = asEmployeeImpact(summary.employee_impact)
  const employeeImpactText = employeeImpact
    ? formatEmployeeImpact(employeeImpact)
    : undefined

  // At-a-glance metric extraction — best-effort, MetricCards filter
  // themselves out when the data isn't there.
  const revenue = findIncomeStatementMetric(
    summary,
    /^(total\s+)?(net\s+)?(revenues?|sales)$/i,
  )
  const netIncome = findIncomeStatementMetric(
    summary,
    /^(net\s+)(income|earnings)/i,
  )
  // Taxes is a universal anchor metric — the card always renders. The
  // resolver walks a tiered strategy (income-statement label match →
  // cash-flow taxes-paid → derive from pre-tax minus net-income →
  // prior-year → "—" fallback) so every filer gets a sensible value.
  const taxes = resolveTaxes(
    summary,
    revenue ? { value: revenue.value, period: revenue.period } : null,
  )
  const ceo = findCeo(executives)

  const keyFactCards = buildKeyFactCards({ revenue, netIncome, taxes, ceo })

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

  const hasNarrative =
    !!riskFactorsText ||
    !!businessOverviewText ||
    !!mdaText ||
    !!legalProceedingsText ||
    !!footnotesText

  const eyebrowParts = [company.exchange, company.sector].filter(Boolean)

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* ── Back nav ────────────────────────────────────────────── */}
        <Anchor
          onClick={() => navigate('/discover')}
          size="sm"
          c="dimmed"
          style={{ cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          ← Discover
        </Anchor>

        {/* ── Hero ────────────────────────────────────────────────── */}
        <PageHeader
          eyebrow={eyebrowParts.length > 0 ? eyebrowParts.join(' · ') : undefined}
          title={company.name}
          description={company.industry ?? undefined}
          actions={
            <Badge color="navy" variant="light" size="lg">
              {company.ticker}
            </Badge>
          }
        />

        {/* AskBar — top-of-page primary action */}
        <AskBar
          companyTicker={company.ticker}
          placeholder={`Ask about ${company.name}…`}
        />

        {/* ── Hero: editorial lede + key-facts rail ──────────────── */}
        {(headline || summaryText) ? (
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <Card h="100%">
                <Stack gap="md">
                  <Eyebrow>This year's story</Eyebrow>
                  {headline ? (
                    <Text
                      fz="22px"
                      fw={600}
                      lh={1.35}
                      style={SERIF_HEADLINE}
                    >
                      {headline}
                    </Text>
                  ) : null}
                  {summaryText ? (
                    <MarkdownContent>
                      {firstParagraph(summaryText)}
                    </MarkdownContent>
                  ) : null}
                </Stack>
              </Card>
            </Grid.Col>
            {keyFactCards.length > 0 ? (
              <Grid.Col span={{ base: 12, lg: 5 }}>
                <Stack gap="sm">{keyFactCards}</Stack>
              </Grid.Col>
            ) : null}
          </Grid>
        ) : keyFactCards.length > 0 ? (
          // No editorial lede — fall back to a horizontal strip so the
          // metrics still anchor the page above the fold.
          <SimpleGrid
            cols={{
              base: 2,
              sm: 2,
              lg: Math.min(keyFactCards.length, 4),
            }}
            spacing="md"
          >
            {keyFactCards}
          </SimpleGrid>
        ) : null}

        {/* ── For employees ───────────────────────────────────────── */}
        {(employeeImpactText || ceo) && (
          <Stack gap="md">
            <SectionHeader
              title="For employees"
              description="What's it like to work here, and who's running the place?"
            />
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              {employeeImpactText ? (
                <TextSummaryCard
                  title="What this means for employees"
                  content={employeeImpactText}
                  maxHeight={360}
                />
              ) : null}
              {executives.length > 0 ? (
                <CeoSpotlightCard
                  executives={executives}
                  ticker={company.ticker}
                />
              ) : null}
            </SimpleGrid>
          </Stack>
        )}

        {/* ── The numbers (Tabs) ──────────────────────────────────── */}
        <Stack gap="md">
          <SectionHeader
            title="The numbers"
            description="Income, financial health, and executive compensation in detail."
          />
          <Tabs defaultValue="income" variant="outline">
            <Tabs.List>
              <Tabs.Tab value="income">Income</Tabs.Tab>
              <Tabs.Tab value="financials">Financials</Tabs.Tab>
              <Tabs.Tab value="comp">Compensation</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="income" pt="md">
              <IncomeStatementSunburst
                summary={summary}
                periodEnd={latestAnnual?.periodEnd}
              />
            </Tabs.Panel>
            <Tabs.Panel value="financials" pt="md">
              <FinancialsSection summary={summary} />
            </Tabs.Panel>
            <Tabs.Panel value="comp" pt="md">
              <CompensationDeepDive
                topExecs={topExecs}
                compBarData={compBarData}
                topExec={topExec}
                breakdownData={breakdownData}
              />
            </Tabs.Panel>
          </Tabs>
        </Stack>

        {/* ── The narrative (Accordion) ───────────────────────────── */}
        {hasNarrative && (
          <Stack gap="md">
            <SectionHeader
              title="The narrative"
              description="Sourced from the most recent annual filing. Click any section to read the full text."
            />
            <Accordion variant="separated" radius="md">
              {riskFactorsText ? (
                <Accordion.Item value="risk_factors">
                  <Accordion.Control>
                    <Text fw={600} size="sm">
                      Risk factors
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <MarkdownContent>{riskFactorsText}</MarkdownContent>
                  </Accordion.Panel>
                </Accordion.Item>
              ) : null}
              {businessOverviewText ? (
                <Accordion.Item value="business_overview">
                  <Accordion.Control>
                    <Text fw={600} size="sm">
                      Business overview
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <MarkdownContent>{businessOverviewText}</MarkdownContent>
                  </Accordion.Panel>
                </Accordion.Item>
              ) : null}
              {mdaText ? (
                <Accordion.Item value="mda">
                  <Accordion.Control>
                    <Text fw={600} size="sm">
                      Management discussion &amp; analysis
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <MarkdownContent>{mdaText}</MarkdownContent>
                  </Accordion.Panel>
                </Accordion.Item>
              ) : null}
              {legalProceedingsText ? (
                <Accordion.Item value="legal_proceedings">
                  <Accordion.Control>
                    <Text fw={600} size="sm">
                      Legal proceedings
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <MarkdownContent>{legalProceedingsText}</MarkdownContent>
                  </Accordion.Panel>
                </Accordion.Item>
              ) : null}
              {footnotesText ? (
                <Accordion.Item value="footnotes">
                  <Accordion.Control>
                    <Text fw={600} size="sm">
                      Notable footnotes
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <MarkdownContent>{footnotesText}</MarkdownContent>
                  </Accordion.Panel>
                </Accordion.Item>
              ) : null}
            </Accordion>
          </Stack>
        )}

        {/* ── People ──────────────────────────────────────────────── */}
        <Stack gap="md">
          <SectionHeader title="People" />
          <LeadershipSection
            executives={executives}
            directors={directors}
            ticker={company.ticker}
            availableFiscalYears={data.availableFiscalYears}
            selectedFiscalYear={data.selectedFiscalYear}
            onFiscalYearChange={setFiscalYear}
          />
        </Stack>

        {/* ── Recent events ───────────────────────────────────────── */}
        {recentEvents.length > 0 && (
          <Stack gap="md">
            <SectionHeader
              title="Recent events"
              description="Material 8-K filings since the latest annual."
            />
            <RecentEventsList events={recentEvents} />
          </Stack>
        )}

        {/* ── Insider activity ────────────────────────────────────── */}
        {insiderTrades.length > 0 && (
          <Stack gap="md">
            <SectionHeader title="Insider activity" />
            <InsiderTradingTable trades={insiderTrades} />
          </Stack>
        )}
      </Stack>
    </Container>
  )
}

// ── Helpers / subcomponents ──────────────────────────────────────────

/**
 * Build the at-a-glance MetricCards in canonical order:
 * Revenue → Net Income → Taxes → CEO Comp → CEO-to-worker.
 * Revenue/Net income/CEO cards filter themselves out when source data
 * is missing; the Taxes card is universal — `resolveTaxes` always
 * returns a render-ready value (with a "—" fallback as a last resort).
 */
function buildKeyFactCards({
  revenue,
  netIncome,
  taxes,
  ceo,
}: {
  revenue: IncomeStatementMetric | null
  netIncome: IncomeStatementMetric | null
  taxes: ResolvedTaxes
  ceo: Executive | null
}): Array<React.ReactNode> {
  const cards: Array<React.ReactNode> = []

  if (revenue) {
    cards.push(
      <MetricCard
        key="revenue"
        label="Revenue"
        value={`$${fmtCompact.format(revenue.value)}`}
        delta={metricDelta(revenue.changePercent)}
        hint={revenue.period ?? undefined}
      />,
    )
  }

  if (netIncome) {
    cards.push(
      <MetricCard
        key="net-income"
        label="Net income"
        value={`$${fmtCompact.format(netIncome.value)}`}
        delta={metricDelta(netIncome.changePercent)}
        hint={netIncome.period ?? undefined}
      />,
    )
  }

  cards.push(
    <MetricCard
      key="taxes"
      label={taxes.label}
      value={taxes.displayValue}
      delta={taxes.delta}
      hint={taxes.hint}
    />,
  )

  if (ceo) {
    cards.push(
      <MetricCard
        key="ceo-comp"
        label="CEO comp"
        value={formatDollarsCompact(ceo.totalCompensation)}
        hint={lastName(ceo.name)}
      />,
    )

    if (ceo.ceoPayRatio) {
      cards.push(
        <MetricCard
          key="ceo-ratio"
          label="CEO-to-worker"
          value={`${ceo.ceoPayRatio}×`}
          hint="vs median worker"
        />,
      )
    }
  }

  return cards
}

function CompensationDeepDive({
  topExecs,
  compBarData,
  topExec,
  breakdownData,
}: {
  topExecs: Array<Executive>
  compBarData: Array<{ name: string; Compensation: number }>
  topExec: Executive | undefined
  breakdownData: Array<{ name: string; value: number; color: string }>
}) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <Card>
        <Stack gap="sm">
          <div>
            <Title order={4}>Top executive compensation</Title>
            <Text size="sm" c="dimmed">
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
              yAxisProps={{
                width: 60,
                tickFormatter: (v) => `$${fmtCompact.format(Number(v))}`,
              }}
              withTooltip
            />
          ) : (
            <Text c="dimmed" size="sm">
              No compensation data available.
            </Text>
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap="sm">
          <div>
            <Title order={4}>
              {topExec ? `${topExec.name} pay mix` : 'Pay mix'}
            </Title>
            <Text size="sm" c="dimmed">
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
            <Text c="dimmed" size="sm">
              Compensation breakdown unavailable.
            </Text>
          )}
        </Stack>
      </Card>
    </SimpleGrid>
  )
}
