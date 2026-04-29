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
  summary: { executive_summary?: string } & Record<string, unknown>
}

interface Executive {
  id: string
  name: string
  title: string
  fiscalYear: number
  totalCompensation: number
  salary: number | null
  bonus: number | null
  stockAwards: number | null
  optionAwards: number | null
  nonEquityIncentive: number | null
  otherCompensation: number | null
}

interface CompanyDetailResponse {
  company: CompanyInfo
  latestAnnual: FilingSummary | null
  executives: Array<Executive>
}

const fmtCompact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/)
  return parts[parts.length - 1] ?? full
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

  useEffect(() => {
    if (!ticker) return
    let cancelled = false

    setLoading(true)
    setError(null)

    fetchWithRetry(`/api/companies/${ticker}/detail`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          const errData = await res.json()
          setError(extractErrorMessage(errData))
          return
        }
        const detail = (await res.json()) as CompanyDetailResponse
        setData(detail)
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
  }, [ticker])

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

  const { company, latestAnnual, executives } = data
  const summaryText = latestAnnual?.summary.executive_summary

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

        {summaryText ? (
          <Card withBorder padding="lg" radius="md">
            <Title order={3} mb="sm">
              Executive Summary
            </Title>
            <MarkdownContent>{summaryText}</MarkdownContent>
          </Card>
        ) : (
          <Alert color="blue" variant="light" title="No summary yet">
            We haven't generated an AI summary for this company's latest
            annual filing yet.
          </Alert>
        )}

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

        <Text c="slate.6" size="xs" ta="center">
          Leadership, financial statements, risk factors, and 8-K events will
          render here as additional sections in a follow-up PR.
        </Text>
      </Stack>
    </Container>
  )
}
