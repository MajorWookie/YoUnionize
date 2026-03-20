import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { Button, H2, H4, Paragraph, Separator, Spinner, View, XStack, YStack } from 'tamagui'
import { ScreenContainer } from '~/interface/layout/ScreenContainer'
import { Card } from '~/interface/display/Card'
import { LoadingState } from '~/interface/display/LoadingState'
import { ErrorState } from '~/interface/display/ErrorState'
import { EmptyState } from '~/interface/display/EmptyState'
import { FairnessGauge } from '~/interface/charts/FairnessGauge'
import { WaterfallChart } from '~/interface/charts/WaterfallChart'
import { MyPayIcon } from '~/interface/icons/TabIcons'
import { useToast } from '~/interface/feedback/ToastProvider'
import { extractErrorMessage, fetchWithRetry } from '~/lib/api-client'
import { formatDate } from '~/features/company/format'
import { COST_OF_LIVING_FIELDS, type CostOfLivingKey } from '~/features/onboarding/constants'

// ── Types ────────────────────────────────────────────────────────────────

interface UserProfile {
  grossAnnualPay: number | null
  companyTicker: string | null
  jobTitle: string | null
  orgLevelCode: string | null
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

interface AnalysisData {
  fairness_score: number
  explanation: string
  comparisons: Array<{ label: string; insight: string }>
  recommendations: Array<string>
  companyTicker: string
  companyName: string
  userPay: number
  jobTitle: string | null
  orgLevel: string | null
}

interface AnalysisRecord {
  id: string
  analysisData: AnalysisData
  createdAt: string
}

// ── Estimated tax rate by income bracket (simplified 2024 US) ──────────

function estimateTaxRate(grossAnnualDollars: number): number {
  if (grossAnnualDollars <= 11_600) return 0.10
  if (grossAnnualDollars <= 47_150) return 0.12
  if (grossAnnualDollars <= 100_525) return 0.22
  if (grossAnnualDollars <= 191_950) return 0.24
  if (grossAnnualDollars <= 243_725) return 0.32
  if (grossAnnualDollars <= 609_350) return 0.35
  return 0.37
}

function fmtDollars(cents: number): string {
  const d = Math.round(cents / 100)
  return `$${d.toLocaleString('en-US')}`
}

function fmtDollarsRaw(dollars: number): string {
  return `$${Math.round(dollars).toLocaleString('en-US')}`
}

// ── Main Screen ──────────────────────────────────────────────────────────

export default function MyPayScreen() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [costOfLiving, setCostOfLiving] = useState<UserCostOfLiving | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null)
  const [history, setHistory] = useState<Array<AnalysisRecord>>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [meRes, analysisRes] = await Promise.all([
        fetchWithRetry('/api/user/me'),
        fetchWithRetry('/api/analysis/compensation-fairness?limit=5'),
      ])

      if (meRes.ok) {
        const meData = await meRes.json()
        setProfile(meData.profile ?? null)
        setCostOfLiving(meData.costOfLiving ?? null)
      }

      if (analysisRes.ok) {
        const aData = await analysisRes.json()
        setAnalysis(aData.latest ?? null)
        setHistory(aData.analyses ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const runAnalysis = async () => {
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetchWithRetry('/api/analysis/compensation-fairness', {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        const msg = extractErrorMessage(data)
        setError(msg)
        showToast(msg, 'error')
        return
      }
      showToast('Analysis complete', 'success')
      // Refetch to get the latest
      await fetchData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed — check your connection'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading your pay analysis..." />
      </ScreenContainer>
    )
  }

  // No pay set
  if (!profile?.grossAnnualPay) {
    return (
      <ScreenContainer>
        <YStack gap="$2" marginBottom="$4">
          <H2>My Pay</H2>
          <Paragraph color="$color8">
            Understand how your compensation compares.
          </Paragraph>
        </YStack>
        <EmptyState
          icon={<MyPayIcon size={48} color="var(--color8)" />}
          title="Add your pay details"
          description="Enter your salary and cost of living in Profile to get a personalized compensation fairness analysis powered by AI."
          actionLabel="Go to Profile"
          onAction={() => router.push('/profile' as never)}
        />
      </ScreenContainer>
    )
  }

  const grossAnnualDollars = profile.grossAnnualPay / 100
  const monthlyIncome = grossAnnualDollars / 12
  const taxRate = estimateTaxRate(grossAnnualDollars)
  const monthlyTaxes = monthlyIncome * taxRate
  const afterTaxMonthly = monthlyIncome - monthlyTaxes

  // Sum cost of living
  const monthlyExpenses = costOfLiving
    ? (Object.entries(costOfLiving) as Array<[string, number | null]>)
        .filter(([key]) => key !== 'savingsTarget')
        .reduce((sum, [, v]) => sum + (v != null ? v / 100 : 0), 0)
    : 0
  const monthlySavings = costOfLiving?.savingsTarget != null ? costOfLiving.savingsTarget / 100 : 0
  const netRemaining = afterTaxMonthly - monthlyExpenses - monthlySavings

  // "What you'd need" calculation
  const totalMonthlyCosts = monthlyExpenses + monthlySavings
  const minimumViableSalary = totalMonthlyCosts > 0
    ? (totalMonthlyCosts * 12) / (1 - taxRate)
    : 0
  const gap = grossAnnualDollars - minimumViableSalary
  const gapPct = minimumViableSalary > 0
    ? ((minimumViableSalary - grossAnnualDollars) / grossAnnualDollars) * 100
    : 0

  const ad = analysis?.analysisData

  return (
    <ScreenContainer>
      <YStack gap="$2" marginBottom="$3">
        <H2>My Pay</H2>
        <Paragraph color="$color8">
          Understand how your compensation compares.
        </Paragraph>
      </YStack>

      <YStack gap="$4" paddingBottom="$6">
        {/* a. Fairness Score */}
        {ad ? (
          <FairnessScoreSection
            analysis={ad}
            createdAt={analysis?.createdAt ?? ''}
            onRefresh={runAnalysis}
            analyzing={analyzing}
          />
        ) : (
          <Card>
            <YStack alignItems="center" gap="$3" padding="$3">
              <Paragraph fontWeight="600" fontSize={16} color="$color12">
                Get Your Fairness Score
              </Paragraph>
              <Paragraph color="$color8" textAlign="center" fontSize={13}>
                {profile.companyTicker
                  ? `Run an AI analysis comparing your pay at ${profile.companyTicker} to executive compensation, industry benchmarks, and your cost of living.`
                  : 'Link your company in Profile to compare your pay to executive compensation.'}
              </Paragraph>
              <Button
                theme="accent"
                onPress={runAnalysis}
                disabled={analyzing || !profile.companyTicker}
              >
                {analyzing ? <Spinner size="small" /> : 'Analyze My Pay'}
              </Button>
            </YStack>
          </Card>
        )}

        {error && (
          <Card>
            <Paragraph color="$negative" fontSize={13}>
              {error}
            </Paragraph>
          </Card>
        )}

        <Separator />

        {/* b. Monthly Budget Breakdown */}
        <BudgetBreakdownSection
          monthlyIncome={monthlyIncome}
          monthlyTaxes={monthlyTaxes}
          monthlyExpenses={monthlyExpenses}
          monthlySavings={monthlySavings}
          netRemaining={netRemaining}
          taxRate={taxRate}
          costOfLiving={costOfLiving}
        />

        <Separator />

        {/* c. What You'd Need */}
        <WhatYouNeedSection
          grossAnnualDollars={grossAnnualDollars}
          minimumViableSalary={minimumViableSalary}
          gap={gap}
          gapPct={gapPct}
          totalMonthlyCosts={totalMonthlyCosts}
          hasCostData={costOfLiving != null && monthlyExpenses > 0}
        />

        {ad && (
          <>
            <Separator />

            {/* d. AI Insights */}
            <AiInsightsSection analysis={ad} />

            <Separator />

            {/* e. Conversation Starters */}
            <ConversationStartersSection analysis={ad} />
          </>
        )}

        {/* Analysis history */}
        {history.length > 1 && (
          <>
            <Separator />
            <AnalysisHistorySection history={history} />
          </>
        )}
      </YStack>
    </ScreenContainer>
  )
}

// ── Section Components ──────────────────────────────────────────────────

function FairnessScoreSection({
  analysis,
  createdAt,
  onRefresh,
  analyzing,
}: {
  analysis: AnalysisData
  createdAt: string
  onRefresh: () => void
  analyzing: boolean
}) {
  return (
    <Card gap="$3">
      <FairnessGauge score={analysis.fairness_score} />

      <Paragraph color="$color8" fontSize={12} textAlign="center">
        Last analyzed {formatDate(createdAt)}
        {analysis.companyName ? ` at ${analysis.companyName}` : ''}
      </Paragraph>

      <Button
        size="$3"
        variant="outlined"
        onPress={onRefresh}
        disabled={analyzing}
        alignSelf="center"
      >
        {analyzing ? <Spinner size="small" /> : 'Refresh Analysis'}
      </Button>
    </Card>
  )
}

function BudgetBreakdownSection({
  monthlyIncome,
  monthlyTaxes,
  monthlyExpenses,
  monthlySavings,
  netRemaining,
  taxRate,
  costOfLiving,
}: {
  monthlyIncome: number
  monthlyTaxes: number
  monthlyExpenses: number
  monthlySavings: number
  netRemaining: number
  taxRate: number
  costOfLiving: UserCostOfLiving | null
}) {
  const [showBreakdown, setShowBreakdown] = useState(false)

  const waterfallItems = [
    {
      label: 'Gross Monthly Income',
      amount: monthlyIncome,
      formattedAmount: fmtDollarsRaw(monthlyIncome),
      type: 'income' as const,
    },
    {
      label: `Est. Taxes (~${Math.round(taxRate * 100)}%)`,
      amount: -monthlyTaxes,
      formattedAmount: `-${fmtDollarsRaw(monthlyTaxes)}`,
      type: 'expense' as const,
    },
    {
      label: 'Living Expenses',
      amount: -monthlyExpenses,
      formattedAmount: monthlyExpenses > 0 ? `-${fmtDollarsRaw(monthlyExpenses)}` : '$0',
      type: 'expense' as const,
    },
    ...(monthlySavings > 0
      ? [
          {
            label: 'Savings Target',
            amount: -monthlySavings,
            formattedAmount: `-${fmtDollarsRaw(monthlySavings)}`,
            type: 'expense' as const,
          },
        ]
      : []),
    {
      label: 'Net Remaining',
      amount: netRemaining,
      formattedAmount: `${netRemaining >= 0 ? '' : '-'}${fmtDollarsRaw(Math.abs(netRemaining))}`,
      type: 'result' as const,
    },
  ]

  return (
    <YStack gap="$3">
      <H4>Monthly Budget</H4>

      <Card gap="$3">
        <WaterfallChart items={waterfallItems} />
      </Card>

      {/* Expense breakdown toggle */}
      {costOfLiving && monthlyExpenses > 0 && (
        <Card
          pressable
          onPress={() => setShowBreakdown((v) => !v)}
          gap="$2"
        >
          <XStack justifyContent="space-between" alignItems="center">
            <Paragraph fontWeight="600" fontSize={14}>
              Expense Breakdown
            </Paragraph>
            <Paragraph color="$color8" fontSize={13}>
              {showBreakdown ? 'Hide' : 'Show'}
            </Paragraph>
          </XStack>

          {showBreakdown && (
            <YStack gap="$1" marginTop="$1">
              {COST_OF_LIVING_FIELDS.filter((f) => f.key !== 'savingsTarget').map((field) => {
                const v = costOfLiving[field.key as CostOfLivingKey]
                if (v == null || v === 0) return null
                const pct = monthlyExpenses > 0 ? (v / 100 / monthlyExpenses) * 100 : 0
                return (
                  <XStack key={field.key} justifyContent="space-between" paddingVertical={2}>
                    <Paragraph fontSize={13} color="$color11" flex={1}>
                      {field.label}
                    </Paragraph>
                    <Paragraph fontSize={13} color="$color8" width={60} textAlign="right">
                      {pct.toFixed(0)}%
                    </Paragraph>
                    <Paragraph fontSize={13} fontWeight="500" color="$color12" width={80} textAlign="right">
                      {fmtDollars(v)}/mo
                    </Paragraph>
                  </XStack>
                )
              })}
            </YStack>
          )}
        </Card>
      )}
    </YStack>
  )
}

function WhatYouNeedSection({
  grossAnnualDollars,
  minimumViableSalary,
  gap,
  gapPct,
  totalMonthlyCosts,
  hasCostData,
}: {
  grossAnnualDollars: number
  minimumViableSalary: number
  gap: number
  gapPct: number
  totalMonthlyCosts: number
  hasCostData: boolean
}) {
  if (!hasCostData) {
    return (
      <YStack gap="$3">
        <H4>What You'd Need</H4>
        <Card>
          <Paragraph color="$color8" fontSize={13}>
            Add your monthly expenses in Profile to see the minimum salary
            needed to cover your costs.
          </Paragraph>
        </Card>
      </YStack>
    )
  }

  const isAbove = gap >= 0

  return (
    <YStack gap="$3">
      <H4>What You'd Need</H4>

      <Card gap="$3">
        <XStack gap="$4" flexWrap="wrap">
          <YStack gap="$1">
            <Paragraph fontSize={12} color="$color8">
              Your Gross Pay
            </Paragraph>
            <Paragraph fontSize={20} fontWeight="700" color="$color12">
              {fmtDollarsRaw(grossAnnualDollars)}/yr
            </Paragraph>
          </YStack>

          <YStack gap="$1">
            <Paragraph fontSize={12} color="$color8">
              Minimum Needed
            </Paragraph>
            <Paragraph fontSize={20} fontWeight="700" color="$color12">
              {fmtDollarsRaw(minimumViableSalary)}/yr
            </Paragraph>
          </YStack>
        </XStack>

        {/* Gap visual */}
        <View height={12} borderRadius={6} backgroundColor="$color4" overflow="hidden">
          {isAbove ? (
            <View height={12} borderRadius={6} width="100%" backgroundColor="#069639" />
          ) : (
            <View
              height={12}
              borderRadius={6}
              width={`${Math.min((grossAnnualDollars / minimumViableSalary) * 100, 100)}%`}
              backgroundColor="#e53e3e"
            />
          )}
        </View>

        <Paragraph
          fontSize={14}
          fontWeight="600"
          color={isAbove ? '$positive' : '$negative'}
        >
          {isAbove
            ? `You're ${fmtDollarsRaw(gap)}/yr above what you need to cover your costs.`
            : `You're ${fmtDollarsRaw(Math.abs(gap))}/yr below what you need to cover your costs.`}
        </Paragraph>

        {!isAbove && (
          <Paragraph color="$color8" fontSize={13} lineHeight={20}>
            You would need a {Math.abs(gapPct).toFixed(1)}% raise to cover your basic costs
            and savings targets. Your total monthly outflow is {fmtDollarsRaw(totalMonthlyCosts)}.
          </Paragraph>
        )}
      </Card>
    </YStack>
  )
}

function AiInsightsSection({ analysis }: { analysis: AnalysisData }) {
  return (
    <YStack gap="$3">
      <H4>AI Insights</H4>

      <Card gap="$3">
        <Paragraph color="$color11" lineHeight={22}>
          {analysis.explanation}
        </Paragraph>
      </Card>

      {analysis.comparisons.length > 0 && (
        <YStack gap="$2">
          {analysis.comparisons.map((comp, idx) => (
            <Card key={idx} gap="$1">
              <Paragraph fontWeight="600" fontSize={14} color="$color12">
                {comp.label}
              </Paragraph>
              <Paragraph color="$color11" fontSize={13} lineHeight={20}>
                {comp.insight}
              </Paragraph>
            </Card>
          ))}
        </YStack>
      )}
    </YStack>
  )
}

function ConversationStartersSection({ analysis }: { analysis: AnalysisData }) {
  if (analysis.recommendations.length === 0) return null

  return (
    <YStack gap="$3">
      <H4>Conversation Starters</H4>
      <Paragraph color="$color8" fontSize={13}>
        Data-backed talking points for your next salary review or negotiation.
      </Paragraph>

      {analysis.recommendations.map((rec, idx) => (
        <Card key={idx} gap="$1">
          <XStack gap="$2" alignItems="flex-start">
            <View
              width={24}
              height={24}
              borderRadius={12}
              backgroundColor="$color4"
              alignItems="center"
              justifyContent="center"
              marginTop={2}
            >
              <Paragraph fontSize={12} fontWeight="700" color="$color9">
                {idx + 1}
              </Paragraph>
            </View>
            <Paragraph flex={1} color="$color11" fontSize={14} lineHeight={22}>
              {rec}
            </Paragraph>
          </XStack>
        </Card>
      ))}
    </YStack>
  )
}

function AnalysisHistorySection({ history }: { history: Array<AnalysisRecord> }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <YStack gap="$3">
      <Card
        pressable
        onPress={() => setExpanded((v) => !v)}
      >
        <XStack justifyContent="space-between" alignItems="center">
          <Paragraph fontWeight="600" fontSize={14}>
            Analysis History ({history.length})
          </Paragraph>
          <Paragraph color="$color8" fontSize={13}>
            {expanded ? 'Hide' : 'Show'}
          </Paragraph>
        </XStack>

        {expanded && (
          <YStack gap="$2" marginTop="$3">
            {history.map((item) => {
              const ad = item.analysisData
              const color =
                ad.fairness_score >= 80
                  ? '#3a6cbb'
                  : ad.fairness_score >= 60
                    ? '#069639'
                    : ad.fairness_score >= 40
                      ? '#d69e2e'
                      : '#e53e3e'

              return (
                <XStack
                  key={item.id}
                  justifyContent="space-between"
                  alignItems="center"
                  paddingVertical="$1"
                  borderBottomWidth={1}
                  borderBottomColor="$color3"
                >
                  <Paragraph fontSize={13} color="$color8">
                    {formatDate(item.createdAt)}
                  </Paragraph>
                  <XStack gap="$2" alignItems="center">
                    <Paragraph fontSize={13} color="$color11">
                      {ad.companyName}
                    </Paragraph>
                    <Paragraph fontSize={16} fontWeight="700" color={color}>
                      {ad.fairness_score}
                    </Paragraph>
                  </XStack>
                </XStack>
              )
            })}
          </YStack>
        )}
      </Card>
    </YStack>
  )
}
