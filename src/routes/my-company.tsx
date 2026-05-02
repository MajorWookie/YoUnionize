import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  Alert,
  Badge,
  Box,
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
import { extractErrorMessage, fetchWithRetry } from '@younionize/api-client'
import { ComparisonBar } from '~/components/charts/ComparisonBar'
import {
  InsiderTradingTable,
  type InsiderTrade,
} from '~/components/InsiderTradingTable'
import type { Executive } from '~/lib/exec-types'
import type { FinancialStatement } from '~/lib/financial-types'
import {
  formatDate,
  formatDollarsCompact,
  formatDollarsFull,
  getInitials,
} from '~/lib/format'

import type { RecentEvent } from '~/components/EightKFeed'

interface FilingSummaryShape {
  id: string
  filedAt: string
  summary: Record<string, unknown>
}

interface MyCompanyDetail {
  company: {
    id: string
    ticker: string
    name: string
    sector: string | null
    industry: string | null
    exchange: string | null
  }
  latestAnnual: FilingSummaryShape | null
  latestQuarterly: FilingSummaryShape | null
  latestProxy: FilingSummaryShape | null
  executives: Array<Executive>
  insiderTrades: Array<InsiderTrade>
  recentEvents: Array<RecentEvent>
  status?: {
    hasData?: boolean
    summarizedFilings?: number
  }
}

interface UserProfile {
  grossAnnualPay: number | null
  companyTicker: string | null
  jobTitle: string | null
}

interface CostOfLiving {
  rentMortgage: number | null
  internet: number | null
  mobilePhone: number | null
  utilities: number | null
  studentLoans: number | null
  consumerDebt: number | null
  carLoan: number | null
  groceries: number | null
  gym: number | null
  entertainment: number | null
  clothing: number | null
  savingsTarget: number | null
  other: number | null
}

interface KeyNumber {
  label: string
  value: string
}

interface ExecutiveSummary {
  key_numbers?: Array<KeyNumber>
  employee_relevance?: string
}

interface ExecCompSummary {
  analysis?: string
  employeeCompAsRiskFactor?: boolean
}

export function MyCompanyPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [costOfLiving, setCostOfLiving] = useState<CostOfLiving | null>(null)
  const [data, setData] = useState<MyCompanyDetail | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const meRes = await fetchWithRetry('/api/user/me')
      if (!meRes.ok) throw new Error('Failed to load profile')
      const meData = await meRes.json()

      const p: UserProfile | null = meData.profile ?? null
      setProfile(p)
      setCostOfLiving(meData.costOfLiving ?? null)

      if (!p?.companyTicker) {
        setLoading(false)
        return
      }

      await fetchWithRetry('/api/companies/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: p.companyTicker }),
      })

      const detailRes = await fetchWithRetry(
        `/api/companies/${p.companyTicker}/detail`,
      )
      if (!detailRes.ok) {
        const errData = await detailRes.json().catch(() => ({}))
        throw new Error(
          extractErrorMessage(errData) || 'Failed to load company data',
        )
      }
      const detail = (await detailRes.json()) as MyCompanyDetail
      setData(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  if (loading) {
    return (
      <Center mih="60vh">
        <Stack gap="xs" align="center">
          <Loader />
          <Text c="slate.7">Loading your company…</Text>
        </Stack>
      </Center>
    )
  }

  if (error) {
    return (
      <Container size="md" py="xl">
        <Alert color="red" title="Could not load">
          {error}
        </Alert>
        <Group mt="md">
          <Button variant="default" onClick={fetchAll}>
            Retry
          </Button>
        </Group>
      </Container>
    )
  }

  if (!profile?.companyTicker) {
    return (
      <Container size="md" py="xl">
        <Stack gap="md">
          <Title order={2}>My Company</Title>
          <Text c="slate.7">Your employer's financial health at a glance.</Text>
          <Card withBorder padding="lg">
            <Stack gap="md" align="center">
              <Title order={4}>No company linked</Title>
              <Text size="sm" c="slate.7" ta="center">
                Set your employer in your Profile to see filing summaries,
                executive compensation, and insider trading activity.
              </Text>
              <Button onClick={() => navigate('/profile')}>Go to Profile</Button>
            </Stack>
          </Card>
        </Stack>
      </Container>
    )
  }

  const noFilings =
    !data ||
    data.status?.hasData === false ||
    (data.status?.summarizedFilings ?? 0) === 0

  if (noFilings) {
    return (
      <Container size="md" py="xl">
        <Stack gap="md">
          <Title order={2}>My Company</Title>
          {data && (
            <CompanyHeading
              name={data.company.name}
              ticker={data.company.ticker}
              sector={data.company.sector}
              industry={data.company.industry}
              exchange={data.company.exchange}
            />
          )}
          <Alert color="yellow" title="No filings ingested yet">
            We don't have summarized filings for this company yet. Visit the
            company page to ingest filings and generate AI summaries.
          </Alert>
          <Group>
            <Button
              component={RouterLink}
              to={`/companies/${profile.companyTicker}`}
            >
              Open company page
            </Button>
          </Group>
        </Stack>
      </Container>
    )
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>My Company</Title>
        </Stack>

        <AtAGlance data={data} />

        <Divider />

        <YouVsLeadership
          executives={data.executives}
          userPay={profile.grossAnnualPay}
          userTitle={profile.jobTitle}
        />

        <Divider />

        <CashFlowComparison
          data={data}
          userPay={profile.grossAnnualPay}
          costOfLiving={costOfLiving}
        />

        <Divider />

        <CompanyPayInsights data={data} />

        <Divider />

        <InsiderActivity
          trades={data.insiderTrades}
          companyName={data.company.name}
        />
      </Stack>
    </Container>
  )
}

function CompanyHeading({
  name,
  ticker,
  sector,
  industry,
  exchange,
}: {
  name: string
  ticker: string
  sector: string | null
  industry: string | null
  exchange: string | null
}) {
  return (
    <Stack gap={4}>
      <Group gap="sm">
        <Title order={3}>{name}</Title>
        <Badge variant="light" color="navy">
          {ticker}
        </Badge>
      </Group>
      <Text size="sm" c="slate.7">
        {[sector, industry, exchange].filter(Boolean).join(' · ') || '—'}
      </Text>
    </Stack>
  )
}

function AtAGlance({ data }: { data: MyCompanyDetail }) {
  const annualSummary = data.latestAnnual?.summary
  const execSummary = annualSummary?.executive_summary as
    | ExecutiveSummary
    | undefined
  const keyNumbers = execSummary?.key_numbers ?? []

  const revenue = keyNumbers.find(
    (kn) => /revenue/i.test(kn.label) || /total\s*revenue/i.test(kn.label),
  )
  const netIncome = keyNumbers.find(
    (kn) => /net\s*income/i.test(kn.label) || /earnings/i.test(kn.label),
  )
  const employees = keyNumbers.find((kn) => /employee/i.test(kn.label))

  const latestFiled = data.latestAnnual?.filedAt ?? data.latestQuarterly?.filedAt

  const stats: Array<{ label: string; value: string }> = []
  if (latestFiled) stats.push({ label: 'Latest Filing', value: formatDate(latestFiled) })
  if (revenue) stats.push({ label: revenue.label, value: revenue.value })
  if (netIncome) stats.push({ label: netIncome.label, value: netIncome.value })
  if (employees) stats.push({ label: employees.label, value: employees.value })

  return (
    <Card withBorder padding="md">
      <Stack gap="md">
        <CompanyHeading
          name={data.company.name}
          ticker={data.company.ticker}
          sector={data.company.sector}
          industry={data.company.industry}
          exchange={data.company.exchange}
        />
        {stats.length > 0 && (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            {stats.map((s) => (
              <Stack key={s.label} gap={2}>
                <Text size="xs" c="slate.7">
                  {s.label}
                </Text>
                <Text size="sm" fw={600}>
                  {s.value}
                </Text>
              </Stack>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Card>
  )
}

function YouVsLeadership({
  executives,
  userPay,
  userTitle,
}: {
  executives: Array<Executive>
  userPay: number | null
  userTitle: string | null
}) {
  if (executives.length === 0) return null

  const seen = new Map<string, Executive>()
  for (const exec of executives) {
    const existing = seen.get(exec.name)
    if (!existing || exec.totalCompensation > existing.totalCompensation) {
      seen.set(exec.name, exec)
    }
  }
  const top5 = [...seen.values()]
    .sort((a, b) => b.totalCompensation - a.totalCompensation)
    .slice(0, 5)

  const ceo = top5.find((e) => /ceo|chief executive/i.test(e.title))
  const ceoPayRatio = ceo?.ceoPayRatio
  const ceoRatio =
    ceo && userPay && userPay > 0
      ? Math.round(ceo.totalCompensation / userPay)
      : null

  return (
    <Stack gap="md">
      <Title order={4}>You vs. Leadership</Title>

      {userPay == null && (
        <Alert color="yellow" variant="light">
          Add your gross annual pay in Profile to see a side-by-side comparison.
        </Alert>
      )}

      {ceoRatio != null && ceoRatio > 0 && (
        <Card withBorder padding="md" bg="navy.0">
          <Stack gap={4}>
            <Text fw={700} size="32px" c="navy.7">
              {ceoRatio}x
            </Text>
            <Text c="slate.8">
              The CEO makes {ceoRatio} times your salary.
              {ceoPayRatio
                ? ` The company's reported CEO-to-median-worker ratio is ${ceoPayRatio}:1.`
                : ''}
            </Text>
          </Stack>
        </Card>
      )}

      <Stack gap="sm">
        {top5.map((exec) => {
          const userPct =
            userPay && exec.totalCompensation > 0
              ? Math.max(
                  Math.min((userPay / exec.totalCompensation) * 100, 100),
                  0.5,
                )
              : 0
          return (
            <Card key={exec.id} withBorder padding="md">
              <Stack gap="sm">
                <Group gap="md" wrap="nowrap">
                  <Box
                    bg="navy.0"
                    w={40}
                    h={40}
                    style={{
                      borderRadius: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: '0 0 auto',
                    }}
                  >
                    <Text fw={700} c="navy.7" size="sm">
                      {getInitials(exec.name)}
                    </Text>
                  </Box>
                  <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={600}>{exec.name}</Text>
                    <Text size="xs" c="slate.7" lineClamp={1}>
                      {exec.title}
                    </Text>
                  </Stack>
                  <Text fw={700}>
                    {formatDollarsCompact(exec.totalCompensation)}
                  </Text>
                </Group>

                {userPay != null && userPay > 0 && (
                  <Stack gap={6}>
                    <Group gap="sm" wrap="nowrap">
                      <Text size="xs" c="slate.7" w={32}>
                        Exec
                      </Text>
                      <Box
                        h={8}
                        bg="slate.2"
                        style={{
                          flex: 1,
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <Box bg="red.5" h="100%" style={{ width: '100%' }} />
                      </Box>
                    </Group>
                    <Group gap="sm" wrap="nowrap">
                      <Text size="xs" c="slate.7" w={32}>
                        You
                      </Text>
                      <Box
                        h={8}
                        bg="slate.2"
                        style={{
                          flex: 1,
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          bg="green.6"
                          h="100%"
                          style={{ width: `${userPct}%` }}
                        />
                      </Box>
                    </Group>
                    <Text size="xs" c="slate.7">
                      {userTitle ?? 'You'}: {formatDollarsFull(userPay)} vs{' '}
                      {exec.title}: {formatDollarsCompact(exec.totalCompensation)}
                    </Text>
                  </Stack>
                )}
              </Stack>
            </Card>
          )
        })}
      </Stack>
    </Stack>
  )
}

function CashFlowComparison({
  data,
  userPay,
  costOfLiving,
}: {
  data: MyCompanyDetail
  userPay: number | null
  costOfLiving: CostOfLiving | null
}) {
  const summary = (data.latestAnnual?.summary ?? data.latestQuarterly?.summary) as
    | Record<string, unknown>
    | undefined
  const cashFlowStatement = summary?.cash_flow as FinancialStatement | undefined

  const operating = cashFlowStatement?.items.find(
    (i) => /operating/i.test(i.label) && /cash/i.test(i.label),
  )
  const investing = cashFlowStatement?.items.find(
    (i) => /investing/i.test(i.label) && /cash/i.test(i.label),
  )
  const financing = cashFlowStatement?.items.find(
    (i) => /financing/i.test(i.label) && /cash/i.test(i.label),
  )

  const monthlyIncome = userPay != null ? userPay / 12 : null

  const totalExpenses = costOfLiving
    ? (Object.entries(costOfLiving) as Array<[string, number | null]>)
        .filter(([k]) => k !== 'savingsTarget')
        .reduce((sum, [, v]) => sum + (v ?? 0), 0)
    : 0
  const savings = costOfLiving?.savingsTarget ?? 0
  const netMonthly =
    monthlyIncome != null ? monthlyIncome - totalExpenses - savings : null

  const hasUserData = userPay != null && costOfLiving != null
  const hasCompanyData = operating != null

  if (!hasCompanyData && !hasUserData) return null

  const companyTotal =
    operating && investing && financing
      ? Math.abs(operating.current ?? 0) +
        Math.abs(investing.current ?? 0) +
        Math.abs(financing.current ?? 0)
      : null
  const operatingPct =
    companyTotal && operating?.current != null
      ? Math.abs(operating.current / companyTotal) * 100
      : null
  const userExpensePct =
    monthlyIncome && monthlyIncome > 0
      ? (totalExpenses / monthlyIncome) * 100
      : null

  return (
    <Stack gap="md">
      <Title order={4}>Company Cash Flow vs. Your Cash Flow</Title>
      <Text size="sm" c="slate.7">
        A company's cash flow statement is to the company what your paycheck is
        to you — it shows where the money comes from and where it goes.
      </Text>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Text fw={700} c="navy.6">
              Company
            </Text>
            {hasCompanyData ? (
              <FlowBars
                items={[
                  operating?.current != null && {
                    label: 'Operating',
                    value: operating.current,
                    formatted: formatFinancial(operating.current),
                  },
                  investing?.current != null && {
                    label: 'Investing',
                    value: investing.current,
                    formatted: formatFinancial(investing.current),
                  },
                  financing?.current != null && {
                    label: 'Financing',
                    value: financing.current,
                    formatted: formatFinancial(financing.current),
                  },
                ].filter(
                  (x): x is { label: string; value: number; formatted: string } =>
                    !!x,
                )}
              />
            ) : (
              <Text size="sm" c="slate.6">
                Cash flow data not yet available.
              </Text>
            )}
            {operatingPct != null && (
              <Text size="xs" c="slate.7">
                The company allocates {operatingPct.toFixed(0)}% of cash flows to
                operations.
              </Text>
            )}
          </Stack>
        </Card>

        <Card withBorder padding="md">
          <Stack gap="sm">
            <Text fw={700} c="navy.6">
              You
            </Text>
            {hasUserData && monthlyIncome != null ? (
              <FlowBars
                items={[
                  {
                    label: 'Monthly Income',
                    value: monthlyIncome,
                    formatted: formatDollarsFull(monthlyIncome),
                  },
                  {
                    label: 'Living Expenses',
                    value: -totalExpenses,
                    formatted: `-${formatDollarsFull(totalExpenses)}`,
                  },
                  ...(savings > 0
                    ? [
                        {
                          label: 'Savings',
                          value: -savings,
                          formatted: `-${formatDollarsFull(savings)}`,
                        },
                      ]
                    : []),
                  ...(netMonthly != null
                    ? [
                        {
                          label: 'Remaining',
                          value: netMonthly,
                          formatted:
                            netMonthly >= 0
                              ? formatDollarsFull(netMonthly)
                              : `-${formatDollarsFull(Math.abs(netMonthly))}`,
                        },
                      ]
                    : []),
                ]}
              />
            ) : (
              <Text size="sm" c="slate.6">
                Add your pay and expenses in Profile to see a comparison.
              </Text>
            )}
            {userExpensePct != null && (
              <Text size="xs" c="slate.7">
                You spend {userExpensePct.toFixed(0)}% of your income on living
                expenses.
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      {operatingPct != null && userExpensePct != null && (
        <Card withBorder padding="md" bg="slate.1">
          <Text size="sm">
            The company spends {operatingPct.toFixed(0)}% on operations; you
            spend {userExpensePct.toFixed(0)}% on living expenses.{' '}
            {operatingPct > userExpensePct
              ? 'The company reinvests a larger share of its cash than you spend on day-to-day costs.'
              : 'You spend a larger share of your income on living expenses than the company spends on operations.'}
          </Text>
        </Card>
      )}
    </Stack>
  )
}

function FlowBars({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: number; formatted: string }>
}) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.value)), 1)
  return (
    <Stack gap="xs">
      {items.map((it, idx) => {
        const widthPct = (Math.abs(it.value) / maxAbs) * 100
        const color = it.value >= 0 ? 'green.6' : 'red.5'
        return (
          <Stack key={idx} gap={4}>
            <Group justify="space-between">
              <Text size="sm">{it.label}</Text>
              <Text size="sm" fw={600}>
                {it.formatted}
              </Text>
            </Group>
            <Box
              h={8}
              bg="slate.2"
              style={{ borderRadius: 4, overflow: 'hidden' }}
            >
              <Box bg={color} h="100%" style={{ width: `${widthPct}%` }} />
            </Box>
          </Stack>
        )
      })}
    </Stack>
  )
}

function formatFinancial(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return formatDollarsCompact(n)
  }
  return formatDollarsFull(n)
}

function CompanyPayInsights({ data }: { data: MyCompanyDetail }) {
  const annualSummary = data.latestAnnual?.summary
  const execSummary = annualSummary?.executive_summary as
    | ExecutiveSummary
    | undefined
  const proxySummary = data.latestProxy?.summary
  const execCompSummary = proxySummary?.executive_compensation as
    | ExecCompSummary
    | undefined

  const employeeRelevance = execSummary?.employee_relevance

  const payRelatedEvents = data.recentEvents.filter((e) => {
    const text = e.summary?.event_summary ?? ''
    return /layoff|restructur|compensation|benefit|workforce|headcount|hire|salary/i.test(
      text,
    )
  })

  const hasContent =
    !!employeeRelevance ||
    !!execCompSummary?.analysis ||
    execCompSummary?.employeeCompAsRiskFactor != null ||
    payRelatedEvents.length > 0

  if (!hasContent) return null

  return (
    <Stack gap="md">
      <Title order={4}>What the Company Says About Pay</Title>

      {employeeRelevance && (
        <Card withBorder padding="md">
          <Stack gap={4}>
            <Text fw={600}>Employee Relevance</Text>
            <Text size="sm">{employeeRelevance}</Text>
          </Stack>
        </Card>
      )}

      {execCompSummary?.analysis && (
        <Card withBorder padding="md">
          <Stack gap={4}>
            <Text fw={600}>Executive Compensation Analysis</Text>
            <Text size="sm">{execCompSummary.analysis}</Text>
          </Stack>
        </Card>
      )}

      {execCompSummary != null && (
        <Card withBorder padding="md">
          <Stack gap={4}>
            <Text fw={600}>Compensation as a Risk Factor</Text>
            {execCompSummary.employeeCompAsRiskFactor ? (
              <Stack gap={4}>
                <Text c="red.6" fw={600} size="sm">
                  Yes — employee compensation is listed as a risk factor.
                </Text>
                <Text size="xs" c="slate.7">
                  This means the company has identified labor costs, talent
                  retention, or compensation practices as a material risk to its
                  business. This could mean pressure on future raises or benefits.
                </Text>
              </Stack>
            ) : (
              <Stack gap={4}>
                <Text size="sm">
                  Employee compensation is not listed as a risk factor in the
                  latest filing.
                </Text>
                <Text size="xs" c="slate.7">
                  This is worth noting — it suggests the company does not
                  currently view labor costs as a significant threat to the
                  business.
                </Text>
              </Stack>
            )}
          </Stack>
        </Card>
      )}

      {payRelatedEvents.length > 0 && (
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Text fw={600}>Recent Events Affecting Employees</Text>
            {payRelatedEvents.map((event) => {
              const text = event.summary?.event_summary ?? ''
              return (
                <Stack key={event.id} gap={2}>
                  <Text size="xs" c="slate.7">
                    {formatDate(event.filedAt)}
                  </Text>
                  <Text size="sm">{text}</Text>
                </Stack>
              )
            })}
          </Stack>
        </Card>
      )}
    </Stack>
  )
}

function InsiderActivity({
  trades,
  companyName,
}: {
  trades: Array<InsiderTrade>
  companyName: string
}) {
  if (trades.length === 0) return null

  const now = Date.now()
  const cutoff = now - 90 * 24 * 60 * 60 * 1000
  const recent = trades.filter(
    (t) => new Date(t.transactionDate).getTime() >= cutoff,
  )

  const buys = recent.filter((t) => t.transactionType === 'purchase')
  const sells = recent.filter((t) => t.transactionType === 'sale')

  const totalBuy = buys.reduce((s, t) => s + (t.totalValue ?? 0), 0)
  const totalSell = sells.reduce((s, t) => s + (t.totalValue ?? 0), 0)

  const uniqueBuyers = new Set(buys.map((t) => t.filerName)).size
  const uniqueSellers = new Set(sells.map((t) => t.filerName)).size

  const net = totalBuy - totalSell
  const signal: 'bullish' | 'bearish' | 'neutral' =
    net > 0 ? 'bullish' : net < 0 ? 'bearish' : 'neutral'

  const signalMessages: Record<typeof signal, string> = {
    bullish:
      "Insiders are net buyers — they're putting their own money into the company. This is generally seen as a sign of confidence in the company's future.",
    bearish:
      'Insiders are net sellers. While insider selling can be routine (exercise of options, diversification), heavy selling can signal reduced confidence.',
    neutral:
      'Insider buying and selling are roughly balanced over the past 90 days.',
  }

  if (recent.length === 0) {
    return (
      <Stack gap="md">
        <Title order={4}>Recent Insider Activity</Title>
        <Card withBorder padding="md">
          <Text size="sm" c="slate.7">
            No insider transactions in the past 90 days.
          </Text>
        </Card>
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <Title order={4}>Recent Insider Activity</Title>

      <Card withBorder padding="md">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {sells.length > 0 && (
              <Stack gap={2}>
                <Text size="xs" c="slate.7">
                  Selling
                </Text>
                <Text size="xl" fw={700} c="red.6">
                  {formatDollarsCompact(totalSell)}
                </Text>
                <Text size="xs" c="slate.7">
                  {uniqueSellers} executive{uniqueSellers !== 1 ? 's' : ''} sold
                  stock
                </Text>
              </Stack>
            )}
            {buys.length > 0 && (
              <Stack gap={2}>
                <Text size="xs" c="slate.7">
                  Buying
                </Text>
                <Text size="xl" fw={700} c="green.7">
                  {formatDollarsCompact(totalBuy)}
                </Text>
                <Text size="xs" c="slate.7">
                  {uniqueBuyers} executive{uniqueBuyers !== 1 ? 's' : ''} bought
                  stock
                </Text>
              </Stack>
            )}
          </SimpleGrid>

          {(totalBuy > 0 || totalSell > 0) && (
            <ComparisonBar
              leftLabel="Buying"
              leftValue={totalBuy}
              leftFormatted={formatDollarsCompact(totalBuy)}
              rightLabel="Selling"
              rightValue={totalSell}
              rightFormatted={formatDollarsCompact(totalSell)}
            />
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md" bg="slate.1">
        <Stack gap={4}>
          <Text fw={600}>What this means</Text>
          <Text size="sm">{signalMessages[signal]}</Text>
          {sells.length > 0 && (
            <Text size="xs" c="slate.7">
              In the past 90 days, {uniqueSellers} executive
              {uniqueSellers !== 1 ? 's' : ''} at {companyName} sold{' '}
              {formatDollarsCompact(totalSell)} worth of stock.
            </Text>
          )}
          {buys.length > 0 && (
            <Text size="xs" c="slate.7">
              {uniqueBuyers} executive{uniqueBuyers !== 1 ? 's' : ''} bought{' '}
              {formatDollarsCompact(totalBuy)} worth of stock.
            </Text>
          )}
        </Stack>
      </Card>

      <InsiderTradingTable trades={recent} limit={10} />
    </Stack>
  )
}
