import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Accordion,
  Alert,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCash, IconRefresh, IconSparkles } from '@tabler/icons-react'
import { extractErrorMessage, fetchWithRetry } from '@younionize/api-client'
import { FairnessGauge } from '~/components/charts/FairnessGauge'
import { WaterfallChart } from '~/components/charts/WaterfallChart'
import {
  EmptyState,
  Eyebrow,
  MetricCard,
  PageHeader,
  SectionHeader,
  SkeletonCard,
} from '~/components/primitives'
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

const SERIF_HEADLINE: React.CSSProperties = {
  fontFamily: '"Source Serif 4 Variable", Charter, Georgia, serif',
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

/** Pull a single sentence-y headline from the AI explanation. Falls back to
 *  a length-capped slice if there's no clear sentence boundary. */
function firstSentence(text: string): string {
  if (!text) return ''
  const trimmed = text.trim()
  const match = trimmed.match(/^([^.!?]+[.!?])/)
  const candidate = match?.[1]?.trim() ?? trimmed
  return candidate.length > 200 ? `${candidate.slice(0, 197)}…` : candidate
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

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="xl">
          <PageHeader title="My Pay" />
          <SkeletonCard rows={5} />
          <SkeletonCard rows={4} />
        </Stack>
      </Container>
    )
  }

  // ── No pay set yet → redirect to profile ─────────────────────────────
  if (!profile?.grossAnnualPay) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="xl">
          <PageHeader
            title="My Pay"
            description="Understand how your compensation compares — once you've added your pay details to your profile."
          />
          <EmptyState
            icon={<IconCash size={28} stroke={1.5} />}
            title="Add your pay details"
            description="Enter your salary and cost of living in Profile to get a personalized compensation fairness analysis."
            action={
              <Button onClick={() => navigate('/profile')}>Go to profile</Button>
            }
          />
        </Stack>
      </Container>
    )
  }

  // ── Computed budget metrics ──────────────────────────────────────────
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
  const isAbove = gap >= 0
  const hasCostData = costOfLiving != null && monthlyExpenses > 0
  const ad = analysis?.analysisData

  const waterfallItems = [
    {
      label: 'Gross monthly income',
      amount: monthlyIncome,
      formattedAmount: fmtDollars(monthlyIncome),
      type: 'income' as const,
    },
    {
      label: `Estimated taxes (~${Math.round(taxRate * 100)}%)`,
      amount: -monthlyTaxes,
      formattedAmount: `-${fmtDollars(monthlyTaxes)}`,
      type: 'expense' as const,
    },
    {
      label: 'Living expenses',
      amount: -monthlyExpenses,
      formattedAmount:
        monthlyExpenses > 0 ? `-${fmtDollars(monthlyExpenses)}` : '$0',
      type: 'expense' as const,
    },
    ...(monthlySavings > 0
      ? [
          {
            label: 'Savings target',
            amount: -monthlySavings,
            formattedAmount: `-${fmtDollars(monthlySavings)}`,
            type: 'expense' as const,
          },
        ]
      : []),
    {
      label: 'Net remaining',
      amount: netRemaining,
      formattedAmount: `${netRemaining >= 0 ? '' : '-'}${fmtDollars(Math.abs(netRemaining))}`,
      type: 'result' as const,
    },
  ]

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <PageHeader
          title="My Pay"
          description="Pay fairness, cost of living, and what to do about it."
        />

        {error ? <Alert color="red">{error}</Alert> : null}

        {/* ── Act 1 · Verdict ──────────────────────────────────────── */}
        {ad ? (
          <VerdictHero
            analysis={ad}
            createdAt={analysis?.createdAt ?? ''}
            grossAnnualDollars={grossAnnualDollars}
            minimumViableSalary={minimumViableSalary}
            hasCostData={hasCostData}
            onRefresh={runAnalysis}
            analyzing={analyzing}
          />
        ) : (
          <EmptyState
            icon={<IconSparkles size={28} stroke={1.5} />}
            title="Get your fairness score"
            description={
              profile.companyTicker
                ? `Run an AI analysis comparing your pay at ${profile.companyTicker} to executive compensation, peers, and your cost of living.`
                : 'Link your company in Profile to compare your pay to executive compensation.'
            }
            action={
              <Button
                onClick={runAnalysis}
                loading={analyzing}
                disabled={!profile.companyTicker}
                leftSection={<IconSparkles size={14} />}
              >
                Analyze my pay
              </Button>
            }
          />
        )}

        {/* ── Act 2 · The why ─────────────────────────────────────── */}
        <Stack gap="md">
          <SectionHeader
            title="Where your money goes"
            description="A monthly view of gross pay, taxes, expenses, and what's left."
          />
          <Card>
            <WaterfallChart items={waterfallItems} />
          </Card>

          {hasCostData ? (
            <Text
              size="sm"
              fw={600}
              c={isAbove ? 'green.7' : 'red.6'}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {isAbove
                ? `You're ${fmtDollars(gap)}/yr above what you need to cover your costs.`
                : `You're ${fmtDollars(Math.abs(gap))}/yr below what you need to cover your costs.`}
            </Text>
          ) : null}

          {hasCostData ? (
            <Accordion variant="separated" radius="md">
              <Accordion.Item value="breakdown">
                <Accordion.Control>
                  <Text fw={600} size="sm">
                    Expense breakdown
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap={4} pt="xs">
                    {COST_OF_LIVING_FIELDS.filter(
                      (f) => f.key !== 'savingsTarget',
                    ).map((field) => {
                      const v = costOfLiving?.[field.key]
                      if (v == null || v === 0) return null
                      const pct =
                        monthlyExpenses > 0 ? (v / monthlyExpenses) * 100 : 0
                      return (
                        <Group
                          key={field.key}
                          justify="space-between"
                          gap="xs"
                          wrap="nowrap"
                        >
                          <Text size="sm" style={{ flex: 1 }}>
                            {field.label}
                          </Text>
                          <Text
                            size="sm"
                            c="dimmed"
                            w={48}
                            ta="right"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {pct.toFixed(0)}%
                          </Text>
                          <Text
                            size="sm"
                            fw={500}
                            w={88}
                            ta="right"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {fmtDollars(v)}/mo
                          </Text>
                        </Group>
                      )
                    })}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          ) : null}
        </Stack>

        {/* ── Act 3 · What to do ──────────────────────────────────── */}
        {ad ? (
          <Stack gap="md">
            <SectionHeader
              title="What to do"
              description="Data-backed talking points for your next pay conversation."
            />

            {ad.recommendations.length > 0 ? (
              <Card>
                <Stack gap="lg">
                  {ad.recommendations.map((rec, idx) => (
                    <Group
                      key={idx}
                      align="flex-start"
                      gap="md"
                      wrap="nowrap"
                    >
                      <Text
                        fz="lg"
                        fw={700}
                        c="navy.7"
                        style={{
                          minWidth: 28,
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1.3,
                        }}
                      >
                        {idx + 1}
                      </Text>
                      <Text size="sm" lh={1.55} style={{ flex: 1 }}>
                        {rec}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Card>
            ) : null}

            {ad.comparisons.length > 0 ? (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {ad.comparisons.map((comp, idx) => (
                  <Card key={idx}>
                    <Stack gap="xs">
                      <Eyebrow>{comp.label}</Eyebrow>
                      <Text size="sm">{comp.insight}</Text>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            ) : null}
          </Stack>
        ) : null}

        {/* ── Footer · History disclosure ─────────────────────────── */}
        {history.length > 1 ? (
          <Accordion variant="separated" radius="md">
            <Accordion.Item value="history">
              <Accordion.Control>
                <Text fw={600} size="sm">
                  Past analyses ({history.length})
                </Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs" pt="xs">
                  {history.map((item) => {
                    const adi = item.analysisData
                    const color =
                      adi.fairness_score >= 80
                        ? 'navy.7'
                        : adi.fairness_score >= 60
                          ? 'green.7'
                          : adi.fairness_score >= 40
                            ? 'amber.7'
                            : 'red.6'
                    return (
                      <Group
                        key={item.id}
                        justify="space-between"
                        py="xs"
                        wrap="nowrap"
                        style={{
                          borderBottom:
                            '1px solid var(--mantine-color-default-border)',
                        }}
                      >
                        <Text size="sm" c="dimmed">
                          {formatDate(item.createdAt)}
                        </Text>
                        <Group gap="sm" wrap="nowrap">
                          <Text size="sm">{adi.companyName}</Text>
                          <Text
                            fz="lg"
                            fw={700}
                            c={color}
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {adi.fairness_score}
                          </Text>
                        </Group>
                      </Group>
                    )
                  })}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        ) : null}
      </Stack>
    </Container>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────

interface VerdictHeroProps {
  analysis: AnalysisData
  createdAt: string
  grossAnnualDollars: number
  minimumViableSalary: number
  hasCostData: boolean
  onRefresh: () => void
  analyzing: boolean
}

function VerdictHero({
  analysis,
  createdAt,
  grossAnnualDollars,
  minimumViableSalary,
  hasCostData,
  onRefresh,
  analyzing,
}: VerdictHeroProps) {
  const headline = firstSentence(analysis.explanation)
  const gapPct =
    hasCostData && minimumViableSalary > 0
      ? (grossAnnualDollars / minimumViableSalary - 1) * 100
      : 0
  const minimumDelta =
    hasCostData && minimumViableSalary > 0
      ? gapPct >= 0
        ? {
            value: `+${gapPct.toFixed(0)}% above`,
            direction: 'up' as const,
          }
        : {
            value: `${gapPct.toFixed(0)}% gap`,
            direction: 'down' as const,
          }
      : undefined

  return (
    <Card>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <Stack align="center" justify="center">
          <FairnessGauge score={analysis.fairness_score} size={240} />
        </Stack>

        <Stack gap="md" justify="space-between">
          <Stack gap="md">
            <Eyebrow>Compensation fairness</Eyebrow>
            <Text
              fz="22px"
              fw={600}
              lh={1.35}
              style={SERIF_HEADLINE}
            >
              {headline}
            </Text>
            <SimpleGrid cols={2} spacing="sm">
              <MetricCard
                label="Your pay"
                value={`${fmtDollars(grossAnnualDollars)}/yr`}
              />
              <MetricCard
                label="Minimum to live"
                value={
                  hasCostData ? `${fmtDollars(minimumViableSalary)}/yr` : '—'
                }
                delta={minimumDelta}
                hint={hasCostData ? undefined : 'Add costs in Profile'}
              />
            </SimpleGrid>
          </Stack>

          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text size="xs" c="dimmed">
              Last analyzed {formatDate(createdAt)}
              {analysis.companyName ? ` · ${analysis.companyName}` : ''}
            </Text>
            <Button
              variant="default"
              size="xs"
              onClick={onRefresh}
              loading={analyzing}
              leftSection={<IconRefresh size={12} />}
            >
              Refresh
            </Button>
          </Group>
        </Stack>
      </SimpleGrid>
    </Card>
  )
}
