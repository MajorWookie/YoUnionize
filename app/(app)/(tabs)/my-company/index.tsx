import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { View as RNView } from 'react-native'
import { Button, H2, H4, Paragraph, Separator, View, XStack, YStack } from 'tamagui'
import { fetchWithRetry } from '@younionize/api-client'
import { ScreenContainer } from '~/interface/layout/ScreenContainer'
import { Card } from '~/interface/display/Card'
import { Stat } from '~/interface/display/Stat'
import { LoadingState } from '~/interface/display/LoadingState'
import { ErrorState } from '~/interface/display/ErrorState'
import { EmptyState } from '~/interface/display/EmptyState'
import { CompanyHeader } from '~/interface/layout/CompanyHeader'
import { BarChart } from '~/interface/charts/BarChart'
import { ComparisonBar } from '~/interface/charts/ComparisonBar'
import { IngestionPrompt } from '~/features/company/sections/IngestionPrompt'
import { MyCompanyIcon } from '~/interface/icons/TabIcons'
import {
  formatCents,
  formatFinancial,
  formatDate,
  getInitials,
} from '~/features/company/format'
import type {
  CompanyDetailResponse,
  ExecutiveData,
  FinancialStatement,
  FilingSummaryResult,
  ExecCompSummary,
} from '~/features/company/types'
import { COST_OF_LIVING_FIELDS, type CostOfLivingKey } from '~/features/onboarding/constants'

interface UserProfile {
  grossAnnualPay: number | null
  companyTicker: string | null
  jobTitle: string | null
}

interface UserCostOfLiving {
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

export default function MyCompanyScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [costOfLiving, setCostOfLiving] = useState<UserCostOfLiving | null>(null)
  const [companyData, setCompanyData] = useState<CompanyDetailResponse | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch user profile first
      const meRes = await fetchWithRetry('/api/user/me')
      if (!meRes.ok) throw new Error('Failed to load profile')
      const meData = await meRes.json()

      const p: UserProfile | null = meData.profile
      setProfile(p)
      setCostOfLiving(meData.costOfLiving ?? null)

      if (!p?.companyTicker) {
        setLoading(false)
        return
      }

      // Ensure company exists in DB
      await fetchWithRetry('/api/companies/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: p.companyTicker }),
      })

      // Fetch company detail
      const detailRes = await fetchWithRetry(`/api/companies/${p.companyTicker}/detail`)
      if (!detailRes.ok) throw new Error('Failed to load company data')
      const detail: CompanyDetailResponse = await detailRes.json()
      setCompanyData(detail)
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
      <ScreenContainer>
        <LoadingState message="Loading your company..." />
      </ScreenContainer>
    )
  }

  if (error) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={fetchAll} />
      </ScreenContainer>
    )
  }

  // No company linked
  if (!profile?.companyTicker) {
    return (
      <ScreenContainer>
        <YStack gap="$2" mb="$4">
          <H2>My Company</H2>
          <Paragraph color="$color8">
            Your employer's financial health at a glance.
          </Paragraph>
        </YStack>
        <EmptyState
          icon={<MyCompanyIcon size={48} color="var(--color8)" />}
          title="No company linked"
          description="Set your employer in your Profile to see filing summaries, executive compensation, and insider trading activity."
          actionLabel="Go to Profile"
          onAction={() => router.push('/profile' as never)}
        />
      </ScreenContainer>
    )
  }

  const cd = companyData

  // Company exists in DB but no filings ingested yet
  if (!cd || !cd.status.hasData) {
    return (
      <ScreenContainer>
        <YStack gap="$2" mb="$4">
          <H2>My Company</H2>
        </YStack>
        {cd && (
          <CompanyHeader
            name={cd.company.name}
            ticker={cd.company.ticker}
            sector={cd.company.sector}
          />
        )}
        <IngestionPrompt
          ticker={profile.companyTicker}
          onComplete={fetchAll}
        />
      </ScreenContainer>
    )
  }

  // Data loaded — has summaries?
  if (cd.status.summarizedFilings === 0) {
    return (
      <ScreenContainer>
        <YStack gap="$2" mb="$4">
          <H2>My Company</H2>
        </YStack>
        <CompanyHeader
          name={cd.company.name}
          ticker={cd.company.ticker}
          sector={cd.company.sector}
        />
        <IngestionPrompt
          ticker={profile.companyTicker}
          onComplete={fetchAll}
        />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <YStack gap="$2" mb="$3">
        <H2>My Company</H2>
      </YStack>

      <YStack gap="$4" pb="$6">
        <AtAGlanceCard data={cd} />

        <Separator />

        <YouVsLeadershipSection
          executives={cd.executives}
          userPay={profile.grossAnnualPay}
          userTitle={profile.jobTitle}
          proxyData={cd.latestProxy?.summary as Record<string, unknown> | undefined}
        />

        <Separator />

        <CashFlowComparisonSection
          data={cd}
          userPay={profile.grossAnnualPay}
          costOfLiving={costOfLiving}
        />

        <Separator />

        <CompanyPayInsightsSection data={cd} />

        <Separator />

        <InsiderActivitySection trades={cd.insiderTrades} companyName={cd.company.name} />
      </YStack>
    </ScreenContainer>
  )
}

// ---------------------------------------------------------------------------
// Section 1: At a Glance
// ---------------------------------------------------------------------------

function AtAGlanceCard({ data }: { data: CompanyDetailResponse }) {
  const { company } = data
  const annualSummary = data.latestAnnual?.summary as Record<string, unknown> | undefined
  const execSummary = annualSummary?.executive_summary as FilingSummaryResult | undefined
  const keyNumbers = execSummary?.key_numbers ?? []

  // Try to extract specific financials from key numbers
  const revenue = keyNumbers.find(
    (kn) => /revenue/i.test(kn.label) || /total\s*revenue/i.test(kn.label),
  )
  const netIncome = keyNumbers.find(
    (kn) => /net\s*income/i.test(kn.label) || /earnings/i.test(kn.label),
  )
  const employees = keyNumbers.find((kn) => /employee/i.test(kn.label))

  const latestFiled = data.latestAnnual?.filedAt ?? data.latestQuarterly?.filedAt

  return (
    <Card gap="$3">
      <CompanyHeader
        name={company.name}
        ticker={company.ticker}
        sector={company.sector}
      />

      {company.industry && (
        <Paragraph color="$color8" fontSize={12}>
          {company.industry}
          {company.exchange ? ` \u00b7 ${company.exchange}` : ''}
        </Paragraph>
      )}

      <XStack flexWrap="wrap" gap="$3" mt="$2">
        {latestFiled && (
          <Stat label="Latest Filing" value={formatDate(latestFiled)} />
        )}
        {revenue && <Stat label={revenue.label} value={revenue.value} />}
        {netIncome && <Stat label={netIncome.label} value={netIncome.value} />}
        {employees && <Stat label={employees.label} value={employees.value} />}
      </XStack>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Section 2: You vs. Leadership
// ---------------------------------------------------------------------------

function YouVsLeadershipSection({
  executives,
  userPay,
  userTitle,
  proxyData,
}: {
  executives: Array<ExecutiveData>
  userPay: number | null
  userTitle: string | null
  proxyData: Record<string, unknown> | undefined
}) {
  if (executives.length === 0) return null

  // Dedupe executives by name, keep highest comp
  const seen = new Map<string, ExecutiveData>()
  for (const exec of executives) {
    const existing = seen.get(exec.name)
    if (!existing || exec.totalCompensation > existing.totalCompensation) {
      seen.set(exec.name, exec)
    }
  }
  const top5 = [...seen.values()]
    .sort((a, b) => b.totalCompensation - a.totalCompensation)
    .slice(0, 5)

  // Find CEO
  const ceo = top5.find(
    (e) => /ceo|chief executive/i.test(e.title),
  )
  const ceoPayRatio = ceo?.ceoPayRatio

  // Compute ratio if we have user pay
  const userPayDollars = userPay != null ? userPay / 100 : null
  const ceoRatio =
    ceo && userPayDollars && userPayDollars > 0
      ? Math.round(ceo.totalCompensation / 100 / userPayDollars)
      : null

  return (
    <YStack gap="$3">
      <H4>You vs. Leadership</H4>

      {userPay == null && (
        <Card>
          <Paragraph color="$color8" fontSize={13}>
            Add your gross annual pay in Profile to see a side-by-side comparison.
          </Paragraph>
        </Card>
      )}

      {/* CEO ratio callout */}
      {ceoRatio != null && ceoRatio > 0 && (
        <Card bg="$color3" gap="$2">
          <Paragraph fontWeight="700" fontSize={28} color="$color12">
            {ceoRatio}x
          </Paragraph>
          <Paragraph color="$color11" lineHeight={20}>
            The CEO makes {ceoRatio} times your salary.
            {ceoPayRatio
              ? ` The company's reported CEO-to-median-worker ratio is ${ceoPayRatio}:1.`
              : ''}
          </Paragraph>
        </Card>
      )}

      {/* Pay comparison bars */}
      {top5.map((exec) => {
        const execDollars = exec.totalCompensation / 100
        return (
          <Card key={exec.id} gap="$2">
            <XStack gap="$3" items="center">
              <YStack
                width={40}
                height={40}
                rounded={20}
                bg="$color4"
                items="center"
                justify="center"
              >
                <Paragraph fontWeight="700" color="$color9" fontSize={14}>
                  {getInitials(exec.name)}
                </Paragraph>
              </YStack>
              <YStack flex={1}>
                <Paragraph fontWeight="600" fontSize={14}>
                  {exec.name}
                </Paragraph>
                <Paragraph color="$color8" fontSize={12}>
                  {exec.title}
                </Paragraph>
              </YStack>
              <Paragraph fontWeight="700" fontSize={15} color="$color12">
                {formatCents(exec.totalCompensation)}
              </Paragraph>
            </XStack>

            {userPayDollars != null && userPayDollars > 0 && (
              <YStack mt="$2" gap="$1">
                {/* Exec bar */}
                <XStack items="center" gap="$2">
                  <Paragraph fontSize={11} color="$color8" width={30}>
                    Exec
                  </Paragraph>
                  <RNView style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                    <RNView
                      style={{
                        height: 8,
                        borderRadius: 4,
                        width: '100%',
                        backgroundColor: '#e53e3e',
                      }}
                    />
                  </RNView>
                </XStack>
                {/* User bar */}
                <XStack items="center" gap="$2">
                  <Paragraph fontSize={11} color="$color8" width={30}>
                    You
                  </Paragraph>
                  <RNView style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                    <RNView
                      style={{
                        height: 8,
                        borderRadius: 4,
                        width: `${Math.max(Math.min((userPayDollars / execDollars) * 100, 100), 0.5)}%`,
                        backgroundColor: '#069639',
                      }}
                    />
                  </RNView>
                </XStack>
                <Paragraph fontSize={11} color="$color8" mt={2}>
                  {userTitle ?? 'You'}: {formatCents(userPay)} vs {exec.title}: {formatCents(exec.totalCompensation)}
                </Paragraph>
              </YStack>
            )}
          </Card>
        )
      })}
    </YStack>
  )
}

// ---------------------------------------------------------------------------
// Section 3: Cash Flow Comparison
// ---------------------------------------------------------------------------

function CashFlowComparisonSection({
  data,
  userPay,
  costOfLiving,
}: {
  data: CompanyDetailResponse
  userPay: number | null
  costOfLiving: UserCostOfLiving | null
}) {
  const annualSummary = (data.latestAnnual?.summary ?? data.latestQuarterly?.summary) as
    | Record<string, unknown>
    | undefined
  const cashFlowStatement = annualSummary?.cash_flow as FinancialStatement | undefined

  // Company side
  const operating = cashFlowStatement?.items.find(
    (i) => /operating/i.test(i.label) && /cash/i.test(i.label),
  )
  const investing = cashFlowStatement?.items.find(
    (i) => /investing/i.test(i.label) && /cash/i.test(i.label),
  )
  const financing = cashFlowStatement?.items.find(
    (i) => /financing/i.test(i.label) && /cash/i.test(i.label),
  )

  // User side
  const userPayDollars = userPay != null ? userPay / 100 : null
  const monthlyIncome = userPayDollars != null ? userPayDollars / 12 : null

  // Sum user expenses
  const colValues = costOfLiving
    ? (Object.entries(costOfLiving) as Array<[string, number | null]>)
        .filter(([key]) => key !== 'savingsTarget')
        .reduce((sum, [, v]) => sum + (v != null ? v / 100 : 0), 0)
    : 0
  const savings = costOfLiving?.savingsTarget != null ? costOfLiving.savingsTarget / 100 : 0
  const totalExpenses = colValues // monthly dollars
  const netMonthly = monthlyIncome != null ? monthlyIncome - totalExpenses - savings : null

  const hasUserData = userPay != null && costOfLiving != null
  const hasCompanyData = operating != null

  if (!hasCompanyData && !hasUserData) return null

  // Compute percentages
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
    <YStack gap="$3">
      <H4>Company Cash Flow vs. Your Cash Flow</H4>
      <Paragraph color="$color8" fontSize={13} lineHeight={20}>
        A company's cash flow statement is to the company what your paycheck is to you
        — it shows where the money comes from and where it goes.
      </Paragraph>

      <XStack gap="$3" flexWrap="wrap">
        {/* Company side */}
        <YStack flex={1} minW={280} gap="$2">
          <Card gap="$3">
            <Paragraph fontWeight="700" fontSize={14} color="$color9">
              Company
            </Paragraph>

            {hasCompanyData ? (
              <BarChart
                items={[
                  operating?.current != null
                    ? {
                        label: 'Operating',
                        value: operating.current,
                        formattedValue: formatFinancial(operating.current),
                      }
                    : null,
                  investing?.current != null
                    ? {
                        label: 'Investing',
                        value: investing.current,
                        formattedValue: formatFinancial(investing.current),
                      }
                    : null,
                  financing?.current != null
                    ? {
                        label: 'Financing',
                        value: financing.current,
                        formattedValue: formatFinancial(financing.current),
                      }
                    : null,
                ].filter((x): x is NonNullable<typeof x> => x != null)}
              />
            ) : (
              <Paragraph color="$color7" fontSize={13}>
                Cash flow data not yet available.
              </Paragraph>
            )}

            {operatingPct != null && (
              <Paragraph color="$color8" fontSize={12} mt="$1">
                The company allocates {operatingPct.toFixed(0)}% of cash flows to operations.
              </Paragraph>
            )}
          </Card>
        </YStack>

        {/* User side */}
        <YStack flex={1} minW={280} gap="$2">
          <Card gap="$3">
            <Paragraph fontWeight="700" fontSize={14} color="$color9">
              You
            </Paragraph>

            {hasUserData && monthlyIncome != null ? (
              <BarChart
                items={[
                  {
                    label: 'Monthly Income',
                    value: monthlyIncome,
                    formattedValue: `$${Math.round(monthlyIncome).toLocaleString('en-US')}`,
                  },
                  {
                    label: 'Living Expenses',
                    value: -totalExpenses,
                    formattedValue: `-$${Math.round(totalExpenses).toLocaleString('en-US')}`,
                  },
                  ...(savings > 0
                    ? [
                        {
                          label: 'Savings',
                          value: -savings,
                          formattedValue: `-$${Math.round(savings).toLocaleString('en-US')}`,
                        },
                      ]
                    : []),
                  ...(netMonthly != null
                    ? [
                        {
                          label: 'Remaining',
                          value: netMonthly,
                          formattedValue: `$${Math.round(netMonthly).toLocaleString('en-US')}`,
                        },
                      ]
                    : []),
                ]}
              />
            ) : (
              <Paragraph color="$color7" fontSize={13}>
                Add your pay and expenses in Profile to see a comparison.
              </Paragraph>
            )}

            {userExpensePct != null && (
              <Paragraph color="$color8" fontSize={12} mt="$1">
                You spend {userExpensePct.toFixed(0)}% of your income on living expenses.
              </Paragraph>
            )}
          </Card>
        </YStack>
      </XStack>

      {/* Analogy summary */}
      {operatingPct != null && userExpensePct != null && (
        <Card bg="$color3">
          <Paragraph color="$color11" fontSize={13} lineHeight={20}>
            The company spends {operatingPct.toFixed(0)}% on operations;
            you spend {userExpensePct.toFixed(0)}% on living expenses.
            {operatingPct > userExpensePct
              ? ' The company reinvests a larger share of its cash than you spend on day-to-day costs.'
              : ' You spend a larger share of your income on living expenses than the company spends on operations.'}
          </Paragraph>
        </Card>
      )}
    </YStack>
  )
}

// ---------------------------------------------------------------------------
// Section 4: What the Company Says About Pay
// ---------------------------------------------------------------------------

function CompanyPayInsightsSection({ data }: { data: CompanyDetailResponse }) {
  const annualSummary = data.latestAnnual?.summary as Record<string, unknown> | undefined
  const execSummary = annualSummary?.executive_summary as FilingSummaryResult | undefined
  const proxySummary = data.latestProxy?.summary as Record<string, unknown> | undefined
  const execCompSummary = proxySummary?.executive_compensation as ExecCompSummary | undefined

  const riskFactors = annualSummary?.risk_factors as string | undefined
  const employeeRelevance = execSummary?.employee_relevance

  // Check 8-Ks for pay-related events
  const payRelatedEvents = data.recentEvents.filter((e) => {
    const summary = e.summary as Record<string, unknown> | undefined
    const text = (summary?.event_summary as string) ?? ''
    return /layoff|restructur|compensation|benefit|workforce|headcount|hire|salary/i.test(text)
  })

  const hasContent =
    employeeRelevance ||
    execCompSummary?.analysis ||
    execCompSummary?.employeeCompAsRiskFactor != null ||
    payRelatedEvents.length > 0

  if (!hasContent) return null

  return (
    <YStack gap="$3">
      <H4>What the Company Says About Pay</H4>

      {employeeRelevance && (
        <Card gap="$2">
          <Paragraph fontWeight="600" fontSize={14}>
            Employee Relevance
          </Paragraph>
          <Paragraph color="$color11" fontSize={13} lineHeight={20}>
            {employeeRelevance}
          </Paragraph>
        </Card>
      )}

      {execCompSummary?.analysis && (
        <Card gap="$2">
          <Paragraph fontWeight="600" fontSize={14}>
            Executive Compensation Analysis
          </Paragraph>
          <Paragraph color="$color11" fontSize={13} lineHeight={20}>
            {execCompSummary.analysis}
          </Paragraph>
        </Card>
      )}

      {execCompSummary != null && (
        <Card gap="$2">
          <Paragraph fontWeight="600" fontSize={14}>
            Compensation as a Risk Factor
          </Paragraph>
          {execCompSummary.employeeCompAsRiskFactor ? (
            <YStack gap="$1">
              <Paragraph color="$negative" fontWeight="600" fontSize={13}>
                Yes — employee compensation is listed as a risk factor.
              </Paragraph>
              <Paragraph color="$color8" fontSize={12} lineHeight={18}>
                This means the company has identified labor costs, talent retention, or
                compensation practices as a material risk to its business. This could mean
                pressure on future raises or benefits.
              </Paragraph>
            </YStack>
          ) : (
            <YStack gap="$1">
              <Paragraph color="$color11" fontSize={13}>
                Employee compensation is not listed as a risk factor in the latest filing.
              </Paragraph>
              <Paragraph color="$color8" fontSize={12} lineHeight={18}>
                This is worth noting — it suggests the company does not currently view labor
                costs as a significant threat to the business.
              </Paragraph>
            </YStack>
          )}
        </Card>
      )}

      {payRelatedEvents.length > 0 && (
        <Card gap="$2">
          <Paragraph fontWeight="600" fontSize={14}>
            Recent Events Affecting Employees
          </Paragraph>
          {payRelatedEvents.map((event) => {
            const summary = event.summary as Record<string, unknown> | undefined
            const text = (summary?.event_summary as string) ?? ''
            return (
              <YStack key={event.id} gap="$1" py="$1">
                <Paragraph color="$color8" fontSize={11}>
                  {formatDate(event.filedAt)}
                </Paragraph>
                <Paragraph color="$color11" fontSize={13} lineHeight={20}>
                  {text}
                </Paragraph>
              </YStack>
            )
          })}
        </Card>
      )}
    </YStack>
  )
}

// ---------------------------------------------------------------------------
// Section 5: Recent Insider Activity
// ---------------------------------------------------------------------------

function InsiderActivitySection({
  trades,
  companyName,
}: {
  trades: CompanyDetailResponse['insiderTrades']
  companyName: string
}) {
  if (trades.length === 0) return null

  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const recentTrades = trades.filter(
    (t) => new Date(t.transactionDate) >= ninetyDaysAgo,
  )

  // Aggregate buys and sells
  const buys = recentTrades.filter((t) => t.transactionType === 'purchase')
  const sells = recentTrades.filter((t) => t.transactionType === 'sale')

  const totalBuyValue = buys.reduce((sum, t) => sum + (t.totalValue ?? 0), 0)
  const totalSellValue = sells.reduce((sum, t) => sum + (t.totalValue ?? 0), 0)

  // Unique sellers/buyers
  const uniqueBuyers = new Set(buys.map((t) => t.filerName)).size
  const uniqueSellers = new Set(sells.map((t) => t.filerName)).size

  // Determine signal
  const netActivity = totalBuyValue - totalSellValue
  const signal: 'bullish' | 'bearish' | 'neutral' =
    netActivity > 0 ? 'bullish' : netActivity < 0 ? 'bearish' : 'neutral'

  const signalMessages = {
    bullish:
      'Insiders are net buyers — they\'re putting their own money into the company. This is generally seen as a sign of confidence in the company\'s future.',
    bearish:
      'Insiders are net sellers. While insider selling can be routine (exercise of options, diversification), heavy selling can signal reduced confidence.',
    neutral:
      'Insider buying and selling are roughly balanced over the past 90 days.',
  }

  return (
    <YStack gap="$3">
      <H4>Recent Insider Activity</H4>

      {recentTrades.length === 0 ? (
        <Card>
          <Paragraph color="$color8" fontSize={13}>
            No insider transactions in the past 90 days.
          </Paragraph>
        </Card>
      ) : (
        <>
          {/* Summary card */}
          <Card gap="$3">
            <XStack gap="$4" flexWrap="wrap">
              {sells.length > 0 && (
                <YStack gap="$1">
                  <Paragraph fontSize={12} color="$color8">
                    Selling
                  </Paragraph>
                  <Paragraph fontSize={20} fontWeight="700" color="$negative">
                    {formatCents(totalSellValue)}
                  </Paragraph>
                  <Paragraph fontSize={12} color="$color8">
                    {uniqueSellers} executive{uniqueSellers !== 1 ? 's' : ''} sold stock
                  </Paragraph>
                </YStack>
              )}
              {buys.length > 0 && (
                <YStack gap="$1">
                  <Paragraph fontSize={12} color="$color8">
                    Buying
                  </Paragraph>
                  <Paragraph fontSize={20} fontWeight="700" color="$positive">
                    {formatCents(totalBuyValue)}
                  </Paragraph>
                  <Paragraph fontSize={12} color="$color8">
                    {uniqueBuyers} executive{uniqueBuyers !== 1 ? 's' : ''} bought stock
                  </Paragraph>
                </YStack>
              )}
            </XStack>

            {totalBuyValue > 0 || totalSellValue > 0 ? (
              <ComparisonBar
                leftLabel="Buying"
                leftValue={totalBuyValue / 100}
                leftFormatted={formatCents(totalBuyValue)}
                rightLabel="Selling"
                rightValue={totalSellValue / 100}
                rightFormatted={formatCents(totalSellValue)}
                leftColor="#069639"
                rightColor="#e53e3e"
              />
            ) : null}
          </Card>

          {/* Plain language context */}
          <Card bg="$color3" gap="$2">
            <Paragraph fontWeight="600" fontSize={14} color="$color12">
              What this means
            </Paragraph>
            <Paragraph color="$color11" fontSize={13} lineHeight={20}>
              {signalMessages[signal]}
            </Paragraph>
            {sells.length > 0 && (
              <Paragraph color="$color8" fontSize={12} lineHeight={18}>
                In the past 90 days, {uniqueSellers} executive{uniqueSellers !== 1 ? 's' : ''}{' '}
                at {companyName} sold {formatCents(totalSellValue)} worth of stock.
              </Paragraph>
            )}
            {buys.length > 0 && (
              <Paragraph color="$color8" fontSize={12} lineHeight={18}>
                {uniqueBuyers} executive{uniqueBuyers !== 1 ? 's' : ''}{' '}
                bought {formatCents(totalBuyValue)} worth of stock.
              </Paragraph>
            )}
          </Card>

          {/* Recent trades list */}
          <Card gap="$1">
            <Paragraph fontWeight="600" fontSize={14} mb="$2">
              Recent Transactions
            </Paragraph>
            {recentTrades.slice(0, 10).map((trade) => {
              const isBuy = trade.transactionType === 'purchase'
              const isSell = trade.transactionType === 'sale'
              return (
                <XStack
                  key={trade.id}
                  py="$1.5"
                  borderBottomWidth={1}
                  borderBottomColor="$color3"
                  gap="$2"
                  items="center"
                >
                  <YStack flex={1}>
                    <Paragraph fontSize={13} fontWeight="500" numberOfLines={1}>
                      {trade.filerName}
                    </Paragraph>
                    {trade.filerTitle && (
                      <Paragraph fontSize={11} color="$color8" numberOfLines={1}>
                        {trade.filerTitle}
                      </Paragraph>
                    )}
                  </YStack>
                  <Paragraph
                    fontSize={12}
                    fontWeight="600"
                    color={isBuy ? '$positive' : isSell ? '$negative' : '$color8'}
                  >
                    {isBuy ? 'Buy' : isSell ? 'Sell' : trade.transactionType ?? '-'}
                  </Paragraph>
                  <Paragraph fontSize={12} color="$color11" width={80} text="right">
                    {trade.totalValue != null ? formatCents(trade.totalValue) : '-'}
                  </Paragraph>
                  <Paragraph fontSize={11} color="$color8" width={70} text="right">
                    {formatDate(trade.transactionDate)}
                  </Paragraph>
                </XStack>
              )
            })}
          </Card>
        </>
      )}
    </YStack>
  )
}
