import {
  Anchor,
  Avatar,
  Badge,
  Card,
  Group,
  Progress,
  Stack,
  Text,
  Title,
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
  const segments: Array<BarSegment> = [
    { label: 'Salary', value: ceo.salary ?? 0, color: 'navy.6' },
    { label: 'Bonus + Incentive', value: (ceo.bonus ?? 0) + (ceo.nonEquityIncentive ?? 0), color: 'navy.4' },
    { label: 'Stock Awards', value: ceo.stockAwards ?? 0, color: 'green.6' },
    { label: 'Options', value: ceo.optionAwards ?? 0, color: 'green.4' },
    { label: 'Other', value: (ceo.otherCompensation ?? 0) + (ceo.changeInPensionValue ?? 0), color: 'orange.5' },
  ]
  return segments.filter((s) => s.value > 0)
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
              {segments.map((seg) => (
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
                    {seg.label}
                  </Text>
                </Group>
              ))}
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
