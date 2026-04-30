import {
  Anchor,
  Avatar,
  Badge,
  Card,
  Group,
  Progress,
  Stack,
  Text,
} from '@mantine/core'
import { Link } from 'react-router-dom'
import type { Executive } from '~/lib/exec-types'
import { formatDollarsCompact, getInitials } from '~/lib/format'

interface Props {
  executives: Array<Executive>
  ticker: string
}

const CEO_TITLE_PATTERN = /\b(chief\s+executive\s+officer|ceo)\b/i

/**
 * Pick the CEO from the executives array. Prefers a literal CEO/Chief
 * Executive Officer title match; falls back to the highest-paid exec for
 * companies whose proxy doesn't use that title verbatim.
 */
function findCeo(execs: Array<Executive>): Executive | null {
  if (execs.length === 0) return null
  const byTitle = execs.find((e) => CEO_TITLE_PATTERN.test(e.title))
  if (byTitle) return byTitle
  return execs
    .slice()
    .sort((a, b) => b.totalCompensation - a.totalCompensation)[0]
}

interface BarSegment {
  label: string
  value: number
  color: string
}

function buildSegments(ceo: Executive): Array<BarSegment> {
  // Itemize the comp components individually rather than collapsing
  // bonus+incentive together — when several adjacent items share a
  // color family the bar visually reads as one solid block. Each
  // component now gets a distinct color so even small slices are
  // visible.
  const itemized: Array<BarSegment> = [
    { label: 'Salary', value: ceo.salary ?? 0, color: 'navy.7' },
    { label: 'Bonus', value: ceo.bonus ?? 0, color: 'cyan.6' },
    { label: 'Stock Awards', value: ceo.stockAwards ?? 0, color: 'green.7' },
    { label: 'Options', value: ceo.optionAwards ?? 0, color: 'lime.6' },
    {
      label: 'Non-Equity Incentive',
      value: ceo.nonEquityIncentive ?? 0,
      color: 'teal.6',
    },
    {
      label: 'Pension / NQDC',
      value: ceo.changeInPensionValue ?? 0,
      color: 'grape.5',
    },
    {
      label: 'Other (perks)',
      value: ceo.otherCompensation ?? 0,
      color: 'orange.6',
    },
  ].filter((s) => s.value > 0)

  // Reconcile against totalCompensation. The proxy summary table's
  // total can exceed the sum of itemized line items when the API
  // surfaced the total but didn't expose every sub-line (or rounding).
  // Fill the gap with a muted "Other (unitemized)" segment so the
  // bar reflects the real total — otherwise the bar appears 100%
  // salary even when salary is only ~85% of total comp.
  const knownSum = itemized.reduce((s, x) => s + x.value, 0)
  const gap = ceo.totalCompensation - knownSum
  if (gap > knownSum * 0.005 && knownSum > 0) {
    itemized.push({
      label: 'Other (unitemized)',
      value: gap,
      color: 'gray.5',
    })
  }

  return itemized
}

export function CeoSpotlightCard({ executives, ticker }: Props) {
  const ceo = findCeo(executives)
  if (!ceo) return null

  const segments = buildSegments(ceo)
  const total = segments.reduce((s, x) => s + x.value, 0) || 1

  return (
    <Card withBorder padding="lg" radius="md" bg="navy.0">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <Avatar size="lg" color="navy" radius="xl">
              {getInitials(ceo.name)}
            </Avatar>
            <Stack gap={2}>
              <Group gap="xs">
                <Badge color="navy" variant="filled" size="sm">
                  CEO Spotlight
                </Badge>
                <Text size="xs" c="slate.7">
                  FY {ceo.fiscalYear}
                </Text>
              </Group>
              <Anchor
                component={Link}
                to={`/companies/${ticker}/executive/${ceo.id}`}
                underline="hover"
                fw={700}
                size="lg"
                c="navy.8"
              >
                {ceo.name}
              </Anchor>
              <Text size="sm" c="slate.7">
                {ceo.title}
              </Text>
            </Stack>
          </Group>
          <Stack gap={0} align="flex-end">
            <Text size="xs" c="slate.7">
              Total Comp
            </Text>
            <Text fw={700} size="xl" c="navy.8">
              {formatDollarsCompact(ceo.totalCompensation)}
            </Text>
            {ceo.ceoPayRatio && (
              <Text size="xs" c="slate.7">
                {ceo.ceoPayRatio}:1 vs median worker
              </Text>
            )}
          </Stack>
        </Group>

        {segments.length > 0 && (
          <Stack gap={6}>
            <Progress.Root size="xl" radius="md">
              {segments.map((seg) => (
                <Progress.Section
                  key={seg.label}
                  value={(seg.value / total) * 100}
                  color={seg.color}
                />
              ))}
            </Progress.Root>
            <Group gap="md" wrap="wrap">
              {segments.map((seg) => {
                const pct = ((seg.value / total) * 100).toFixed(0)
                return (
                  <Group key={seg.label} gap={6}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        backgroundColor: `var(--mantine-color-${seg.color.replace('.', '-')})`,
                        borderRadius: 2,
                      }}
                    />
                    <Text size="xs" c="slate.7">
                      <Text span fw={600} c="slate.9">
                        {formatDollarsCompact(seg.value)}
                      </Text>{' '}
                      {seg.label}{' '}
                      <Text span c="slate.6">
                        ({pct}%)
                      </Text>
                    </Text>
                  </Group>
                )
              })}
            </Group>
          </Stack>
        )}

        <Text size="xs" c="slate.6">
          <Anchor
            component={Link}
            to={`/companies/${ticker}/executive/${ceo.id}`}
            size="xs"
          >
            See full compensation breakdown →
          </Anchor>
        </Text>
      </Stack>
    </Card>
  )
}
