/**
 * Multi-ring income statement sunburst section. Renders a 1–3 ring sunburst
 * showing the disposition of revenue (revenue sub-categories → opex vs
 * operating income → below-the-line items), with a year toggle if multiple
 * years of data are available and a click-to-inspect popover.
 */
import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { SunburstChart } from '~/components/SunburstChart'
import {
  extractSunburstYears,
  type SunburstSlice,
} from '~/lib/income-data-extractor'
import type { FinancialStatement } from '~/lib/financial-types'
import { formatDollarsCompact } from '~/lib/format'

interface Props {
  /** filing_summaries.ai_summary for the latest annual filing */
  summary: Record<string, unknown>
  periodEnd?: string | null
}

function asStatement(value: unknown): FinancialStatement | undefined {
  if (!value || typeof value !== 'object') return undefined
  const obj = value as Record<string, unknown>
  if (typeof obj.title !== 'string' || !Array.isArray(obj.items)) {
    return undefined
  }
  return obj as unknown as FinancialStatement
}

export function IncomeStatementSunburst({ summary, periodEnd }: Props) {
  const statement = asStatement(summary.income_statement)

  const allYears = useMemo(
    () => (statement ? extractSunburstYears(statement, periodEnd) : []),
    [statement, periodEnd],
  )

  const [yearIdx, setYearIdx] = useState(0)
  const [activeSlice, setActiveSlice] = useState<SunburstSlice | null>(null)

  if (!statement?.items?.length || allYears.length === 0) return null

  const current = allYears[yearIdx] ?? allYears[0]
  const totalSlices = current.rings.reduce(
    (sum, r) => sum + r.slices.length,
    0,
  )
  if (totalSlices < 2) return null

  // Flat list for the legend: outer ring first, deduped by id.
  const legendItems: Array<SunburstSlice> = []
  const seen = new Set<string>()
  for (const ring of current.rings) {
    for (const slice of ring.slices) {
      if (seen.has(slice.id)) continue
      seen.add(slice.id)
      legendItems.push(slice)
    }
  }

  return (
    <Stack gap="md">
      <Title order={3}>Income Breakdown</Title>
      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          {allYears.length > 1 && (
            <Group gap="xs" justify="center">
              {allYears.map((y, i) => (
                <Button
                  key={y.year}
                  size="xs"
                  variant={i === yearIdx ? 'filled' : 'default'}
                  color="navy"
                  onClick={() => {
                    setYearIdx(i)
                    setActiveSlice(null)
                  }}
                >
                  {y.year}
                </Button>
              ))}
            </Group>
          )}

          <Center>
            <SunburstChart
              rings={current.rings}
              size={320}
              centerValue={current.formattedRevenue}
              centerLabel="Revenue"
              activeSliceId={activeSlice?.id ?? null}
              onSliceClick={(slice) => {
                setActiveSlice((prev) =>
                  prev?.id === slice.id ? null : slice,
                )
              }}
            />
          </Center>

          <Group gap="xs" justify="center" wrap="wrap">
            {legendItems.map((slice) => {
              const isActive = activeSlice?.id === slice.id
              return (
                <Badge
                  key={slice.id}
                  size="md"
                  variant={isActive ? 'filled' : 'light'}
                  style={{
                    backgroundColor: isActive ? slice.color : undefined,
                    color: isActive ? 'white' : undefined,
                    borderColor: slice.color,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    setActiveSlice((prev) =>
                      prev?.id === slice.id ? null : slice,
                    )
                  }
                >
                  {slice.label}
                </Badge>
              )
            })}
          </Group>

          {activeSlice && (
            <Card withBorder bg="slate.0" padding="sm" radius="sm">
              <Stack gap={4}>
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text fw={600} size="sm">
                      {activeSlice.label}
                    </Text>
                    <Text size="xs" c="slate.7">
                      {activeSlice.percentOfRevenue.toFixed(1)}% of revenue
                    </Text>
                  </div>
                  <Text fw={700} size="md" c={activeSlice.color}>
                    {activeSlice.isNegative ? '−' : ''}
                    {formatDollarsCompact(activeSlice.value)}
                  </Text>
                </Group>
                {activeSlice.breakdown && activeSlice.breakdown.length > 0 && (
                  <Stack gap={2} mt={4}>
                    {activeSlice.breakdown.map((item) => (
                      <Group key={item.label} justify="space-between">
                        <Text size="xs" c="slate.7">
                          {item.label}
                        </Text>
                        <Text size="xs" ff="monospace">
                          {formatDollarsCompact(item.value)}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          )}
        </Stack>
      </Card>
    </Stack>
  )
}
