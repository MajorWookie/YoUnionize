import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { extractErrorMessage, fetchWithRetry } from '@younionize/api-client'
import { FairnessGauge } from '~/components/charts/FairnessGauge'
import { WaterfallChart } from '~/components/charts/WaterfallChart'
import {
  COST_OF_LIVING_FIELDS,
  type CostOfLivingKey,
} from '~/lib/onboarding-constants'

interface UserProfile {
  grossAnnualPay: number | null
  companyTicker: string | null
  jobTitle: string | null
  orgLevelCode: string | null
}

type CostOfLiving = Record<CostOfLivingKey, number | null>

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

function estimateTaxRate(grossAnnualDollars: number): number {
  if (grossAnnualDollars <= 11_600) return 0.1
  if (grossAnnualDollars <= 47_150) return 0.12
  if (grossAnnualDollars <= 100_525) return 0.22
  if (grossAnnualDollars <= 191_950) return 0.24
  if (grossAnnualDollars <= 243_725) return 0.32
  if (grossAnnualDollars <= 609_350) return 0.35
  return 0.37
}

function fmtDollars(dollars: number): string {
  return `$${Math.round(dollars).toLocaleString('en-US')}`
}

function formatDate(iso: string): string {
  if (!iso) return 'unknown'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function MyPayPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [costOfLiving, setCostOfLiving] = useState<CostOfLiving | null>(null)
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
        const data = await res.json().catch(() => ({}))
        const msg =
          extractErrorMessage(data) || `Analysis failed (${res.status})`
        setError(msg)
        notifications.show({ message: msg, color: 'red' })
        return
      }
      notifications.show({ message: 'Analysis complete', color: 'green' })
      await fetchData()
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Analysis failed — check your connection'
      setError(msg)
      notifications.show({ message: msg, color: 'red' })
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Text>Loading your pay analysis…</Text>
      </Container>
    )
  }

  if (!profile?.grossAnnualPay) {
    return (
      <Container size="md" py="xl">
        <Stack gap="md">
          <Title order={2}>My Pay</Title>
          <Text c="slate.7">
            Understand how your compensation compares.
          </Text>
          <Card withBorder padding="lg">
            <Stack gap="md" align="center">
              <Title order={4}>Add your pay details</Title>
              <Text size="sm" c="slate.7" ta="center">
                Enter your salary and cost of living in Profile to get a
                personalized compensation fairness analysis powered by AI.
              </Text>
              <Button onClick={() => navigate('/profile')}>Go to Profile</Button>
            </Stack>
          </Card>
        </Stack>
      </Container>
    )
  }

  const grossAnnualDollars = profile.grossAnnualPay
  const monthlyIncome = grossAnnualDollars / 12
  const taxRate = estimateTaxRate(grossAnnualDollars)
  const monthlyTaxes = monthlyIncome * taxRate
  const afterTaxMonthly = monthlyIncome - monthlyTaxes

  const monthlyExpenses = costOfLiving
    ? (Object.entries(costOfLiving) as Array<[string, number | null]>)
        .filter(([key]) => key !== 'savingsTarget')
        .reduce((sum, [, v]) => sum + (v ?? 0), 0)
    : 0
  const monthlySavings = costOfLiving?.savingsTarget ?? 0
  const netRemaining = afterTaxMonthly - monthlyExpenses - monthlySavings

  const totalMonthlyCosts = monthlyExpenses + monthlySavings
  const minimumViableSalary =
    totalMonthlyCosts > 0 ? (totalMonthlyCosts * 12) / (1 - taxRate) : 0
  const gap = grossAnnualDollars - minimumViableSalary
  const gapPct =
    minimumViableSalary > 0
      ? ((minimumViableSalary - grossAnnualDollars) / grossAnnualDollars) * 100
      : 0

  const ad = analysis?.analysisData

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2}>My Pay</Title>
          <Text c="slate.7">
            Understand how your compensation compares.
          </Text>
        </Stack>

        {ad ? (
          <FairnessScoreSection
            analysis={ad}
            createdAt={analysis?.createdAt ?? ''}
            onRefresh={runAnalysis}
            analyzing={analyzing}
          />
        ) : (
          <Card withBorder padding="md">
            <Stack gap="md" align="center">
              <Text fw={600} size="lg">
                Get Your Fairness Score
              </Text>
              <Text c="slate.7" size="sm" ta="center">
                {profile.companyTicker
                  ? `Run an AI analysis comparing your pay at ${profile.companyTicker} to executive compensation, industry benchmarks, and your cost of living.`
                  : 'Link your company in Profile to compare your pay to executive compensation.'}
              </Text>
              <Button
                onClick={runAnalysis}
                loading={analyzing}
                disabled={!profile.companyTicker}
              >
                Analyze My Pay
              </Button>
            </Stack>
          </Card>
        )}

        {error && <Alert color="red">{error}</Alert>}

        <Divider />

        <BudgetBreakdownSection
          monthlyIncome={monthlyIncome}
          monthlyTaxes={monthlyTaxes}
          monthlyExpenses={monthlyExpenses}
          monthlySavings={monthlySavings}
          netRemaining={netRemaining}
          taxRate={taxRate}
          costOfLiving={costOfLiving}
        />

        <Divider />

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
            <Divider />
            <AiInsightsSection analysis={ad} />
            <Divider />
            <ConversationStartersSection analysis={ad} />
          </>
        )}

        {history.length > 1 && (
          <>
            <Divider />
            <AnalysisHistorySection history={history} />
          </>
        )}
      </Stack>
    </Container>
  )
}

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
    <Card withBorder padding="md">
      <Stack gap="md" align="center">
        <FairnessGauge score={analysis.fairness_score} />
        <Text size="xs" c="slate.7" ta="center">
          Last analyzed {formatDate(createdAt)}
          {analysis.companyName ? ` at ${analysis.companyName}` : ''}
        </Text>
        <Button variant="default" onClick={onRefresh} loading={analyzing}>
          Refresh Analysis
        </Button>
      </Stack>
    </Card>
  )
}

function BudgetBreakdownSection(props: {
  monthlyIncome: number
  monthlyTaxes: number
  monthlyExpenses: number
  monthlySavings: number
  netRemaining: number
  taxRate: number
  costOfLiving: CostOfLiving | null
}) {
  const [showBreakdown, setShowBreakdown] = useState(false)

  const items = [
    {
      label: 'Gross Monthly Income',
      amount: props.monthlyIncome,
      formattedAmount: fmtDollars(props.monthlyIncome),
      type: 'income' as const,
    },
    {
      label: `Est. Taxes (~${Math.round(props.taxRate * 100)}%)`,
      amount: -props.monthlyTaxes,
      formattedAmount: `-${fmtDollars(props.monthlyTaxes)}`,
      type: 'expense' as const,
    },
    {
      label: 'Living Expenses',
      amount: -props.monthlyExpenses,
      formattedAmount:
        props.monthlyExpenses > 0
          ? `-${fmtDollars(props.monthlyExpenses)}`
          : '$0',
      type: 'expense' as const,
    },
    ...(props.monthlySavings > 0
      ? [
          {
            label: 'Savings Target',
            amount: -props.monthlySavings,
            formattedAmount: `-${fmtDollars(props.monthlySavings)}`,
            type: 'expense' as const,
          },
        ]
      : []),
    {
      label: 'Net Remaining',
      amount: props.netRemaining,
      formattedAmount: `${props.netRemaining >= 0 ? '' : '-'}${fmtDollars(Math.abs(props.netRemaining))}`,
      type: 'result' as const,
    },
  ]

  return (
    <Stack gap="md">
      <Title order={4}>Monthly Budget</Title>
      <Card withBorder padding="md">
        <WaterfallChart items={items} />
      </Card>

      {props.costOfLiving && props.monthlyExpenses > 0 && (
        <Card
          withBorder
          padding="md"
          onClick={() => setShowBreakdown((v) => !v)}
          style={{ cursor: 'pointer' }}
        >
          <Group justify="space-between">
            <Text fw={600} size="sm">
              Expense Breakdown
            </Text>
            <Text size="sm" c="slate.7">
              {showBreakdown ? 'Hide' : 'Show'}
            </Text>
          </Group>
          {showBreakdown && (
            <Stack gap={4} mt="sm">
              {COST_OF_LIVING_FIELDS.filter(
                (f) => f.key !== 'savingsTarget',
              ).map((field) => {
                const v = props.costOfLiving![field.key]
                if (v == null || v === 0) return null
                const pct =
                  props.monthlyExpenses > 0
                    ? (v / props.monthlyExpenses) * 100
                    : 0
                return (
                  <Group key={field.key} justify="space-between" gap="xs">
                    <Text size="sm" style={{ flex: 1 }}>
                      {field.label}
                    </Text>
                    <Text size="sm" c="slate.7" w={48} ta="right">
                      {pct.toFixed(0)}%
                    </Text>
                    <Text size="sm" fw={500} w={88} ta="right">
                      {fmtDollars(v)}/mo
                    </Text>
                  </Group>
                )
              })}
            </Stack>
          )}
        </Card>
      )}
    </Stack>
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
      <Stack gap="md">
        <Title order={4}>What You'd Need</Title>
        <Card withBorder padding="md">
          <Text size="sm" c="slate.7">
            Add your monthly expenses in Profile to see the minimum salary
            needed to cover your costs.
          </Text>
        </Card>
      </Stack>
    )
  }

  const isAbove = gap >= 0
  const fillPct = isAbove
    ? 100
    : Math.min(
        (grossAnnualDollars / Math.max(minimumViableSalary, 1)) * 100,
        100,
      )

  return (
    <Stack gap="md">
      <Title order={4}>What You'd Need</Title>
      <Card withBorder padding="md">
        <Stack gap="md">
          <Group gap="xl" wrap="wrap">
            <Stack gap={2}>
              <Text size="xs" c="slate.7">
                Your Gross Pay
              </Text>
              <Text size="xl" fw={700}>
                {fmtDollars(grossAnnualDollars)}/yr
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="slate.7">
                Minimum Needed
              </Text>
              <Text size="xl" fw={700}>
                {fmtDollars(minimumViableSalary)}/yr
              </Text>
            </Stack>
          </Group>

          <Box
            bg="slate.2"
            h={12}
            style={{ borderRadius: 6, overflow: 'hidden' }}
          >
            <Box
              h="100%"
              bg={isAbove ? 'green.6' : 'red.5'}
              style={{ width: `${fillPct}%` }}
            />
          </Box>

          <Text size="sm" fw={600} c={isAbove ? 'green.7' : 'red.6'}>
            {isAbove
              ? `You're ${fmtDollars(gap)}/yr above what you need to cover your costs.`
              : `You're ${fmtDollars(Math.abs(gap))}/yr below what you need to cover your costs.`}
          </Text>

          {!isAbove && (
            <Text size="sm" c="slate.7">
              You would need a {Math.abs(gapPct).toFixed(1)}% raise to cover
              your basic costs and savings targets. Your total monthly outflow
              is {fmtDollars(totalMonthlyCosts)}.
            </Text>
          )}
        </Stack>
      </Card>
    </Stack>
  )
}

function AiInsightsSection({ analysis }: { analysis: AnalysisData }) {
  const comparisons = analysis.comparisons ?? []
  return (
    <Stack gap="md">
      <Title order={4}>AI Insights</Title>
      <Card withBorder padding="md">
        <Text>{analysis.explanation ?? 'No explanation available for this analysis.'}</Text>
      </Card>
      {comparisons.length > 0 && (
        <Stack gap="sm">
          {comparisons.map((comp, idx) => (
            <Card key={idx} withBorder padding="md">
              <Stack gap={4}>
                <Text fw={600}>{comp.label}</Text>
                <Text size="sm">{comp.insight}</Text>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

function ConversationStartersSection({
  analysis,
}: {
  analysis: AnalysisData
}) {
  const recommendations = analysis.recommendations ?? []
  if (recommendations.length === 0) return null
  return (
    <Stack gap="md">
      <Title order={4}>Conversation Starters</Title>
      <Text size="sm" c="slate.7">
        Data-backed talking points for your next salary review or negotiation.
      </Text>
      {recommendations.map((rec, idx) => (
        <Card key={idx} withBorder padding="md">
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <Box
              bg="navy.0"
              w={28}
              h={28}
              style={{
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
              }}
            >
              <Text fw={700} size="sm" c="navy.7">
                {idx + 1}
              </Text>
            </Box>
            <Text style={{ flex: 1 }}>{rec}</Text>
          </Group>
        </Card>
      ))}
    </Stack>
  )
}

function AnalysisHistorySection({
  history,
}: {
  history: Array<AnalysisRecord>
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card
      withBorder
      padding="md"
      onClick={() => setExpanded((v) => !v)}
      style={{ cursor: 'pointer' }}
    >
      <Group justify="space-between">
        <Text fw={600} size="sm">
          Analysis History ({history.length})
        </Text>
        <Text size="sm" c="slate.7">
          {expanded ? 'Hide' : 'Show'}
        </Text>
      </Group>
      {expanded && (
        <Stack gap="xs" mt="md">
          {history.map((item) => {
            const ad = item.analysisData
            const color =
              ad.fairness_score >= 80
                ? 'navy.7'
                : ad.fairness_score >= 60
                  ? 'green.7'
                  : ad.fairness_score >= 40
                    ? 'yellow.7'
                    : 'red.6'
            return (
              <Group
                key={item.id}
                justify="space-between"
                py="xs"
                style={{
                  borderBottom: '1px solid var(--mantine-color-slate-2)',
                }}
              >
                <Text size="sm" c="slate.7">
                  {formatDate(item.createdAt)}
                </Text>
                <Group gap="sm">
                  <Text size="sm">{ad.companyName}</Text>
                  <Text size="lg" fw={700} c={color}>
                    {ad.fairness_score}
                  </Text>
                </Group>
              </Group>
            )
          })}
        </Stack>
      )}
    </Card>
  )
}
