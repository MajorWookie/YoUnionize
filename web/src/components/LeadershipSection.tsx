import {
  Avatar,
  Badge,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { Link } from 'react-router-dom'
import type { Director, Executive } from '~/lib/exec-types'
import { formatDollarsCompact, getInitials } from '~/lib/format'

// Re-export the shared types so existing importers (CompanyPage)
// don't break — DirectorRow was the local name we used previously.
export type { Director as DirectorRow, Executive as ExecutiveRow }

interface Props {
  executives: Array<Executive>
  directors: Array<Director>
  ticker: string
  availableFiscalYears?: Array<number>
  selectedFiscalYear?: number | null
  onFiscalYearChange?: (year: number) => void
}

function parseCommittees(raw: unknown): Array<string> {
  if (Array.isArray(raw))
    return raw.filter((c): c is string => typeof c === 'string')
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((c): c is string => typeof c === 'string')
      }
    } catch {
      return [raw]
    }
  }
  return []
}

function tenureYear(start: string | null): number | null {
  if (!start) return null
  const y = Number(start.slice(0, 4))
  return Number.isNaN(y) ? null : y
}

export function LeadershipSection({
  executives,
  directors,
  ticker,
  availableFiscalYears,
  selectedFiscalYear,
  onFiscalYearChange,
}: Props) {
  if (executives.length === 0 && directors.length === 0) return null

  const dedupedExecs = (() => {
    const seen = new Map<string, Executive>()
    for (const exec of executives) {
      const key = exec.name.toLowerCase()
      const existing = seen.get(key)
      if (!existing || exec.totalCompensation > existing.totalCompensation) {
        seen.set(key, exec)
      }
    }
    return [...seen.values()].sort(
      (a, b) => b.totalCompensation - a.totalCompensation,
    )
  })()

  const yearOptions =
    availableFiscalYears && availableFiscalYears.length > 1
      ? availableFiscalYears
          .slice()
          .sort((a, b) => b - a)
          .map((y) => ({ label: String(y), value: String(y) }))
      : null

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Title order={3}>Leadership</Title>
        {yearOptions && selectedFiscalYear != null && onFiscalYearChange && (
          <SegmentedControl
            size="xs"
            value={String(selectedFiscalYear)}
            onChange={(v) => onFiscalYearChange(Number(v))}
            data={yearOptions}
          />
        )}
      </Group>

      {dedupedExecs.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" c="slate.7" fw={600}>
            Named Executives ({dedupedExecs.length})
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {dedupedExecs.map((exec) => (
              <Card
                key={exec.id}
                withBorder
                padding="md"
                radius="md"
                component={Link}
                to={`/companies/${ticker}/executive/${exec.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Group gap="sm" wrap="nowrap">
                  <Avatar color="navy" radius="xl">
                    {getInitials(exec.name)}
                  </Avatar>
                  <Stack gap={0} flex={1} miw={0}>
                    <Text fw={600} size="sm" lineClamp={1}>
                      {exec.name}
                    </Text>
                    <Text size="xs" c="slate.7" lineClamp={1}>
                      {exec.title}
                    </Text>
                    <Text size="xs" c="navy.7" fw={600} mt={4}>
                      {formatDollarsCompact(exec.totalCompensation)} · FY{' '}
                      {exec.fiscalYear}
                    </Text>
                  </Stack>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      )}

      {directors.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" c="slate.7" fw={600}>
            Board of Directors ({directors.length})
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {directors.map((dir) => {
              const committees = parseCommittees(dir.committees)
              const since = tenureYear(dir.tenureStart)
              return (
                <Card
                  key={dir.id}
                  withBorder
                  padding="md"
                  radius="md"
                  component={Link}
                  to={`/companies/${ticker}/executive/${dir.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <Stack gap="xs">
                    <Group gap="sm" wrap="nowrap" align="flex-start">
                      <Avatar color="slate" radius="xl">
                        {getInitials(dir.name)}
                      </Avatar>
                      <Stack gap={0} flex={1} miw={0}>
                        <Text fw={600} size="sm" lineClamp={1}>
                          {dir.name}
                        </Text>
                        <Text size="xs" c="slate.7" lineClamp={1}>
                          {dir.title}
                        </Text>
                      </Stack>
                      {dir.isIndependent != null && (
                        <Badge
                          size="xs"
                          color={dir.isIndependent ? 'green' : 'slate'}
                          variant="light"
                        >
                          {dir.isIndependent ? 'Independent' : 'Affiliated'}
                        </Badge>
                      )}
                    </Group>
                    {(since != null || committees.length > 0) && (
                      <Text size="xs" c="slate.6" lineClamp={1}>
                        {since != null && `Since ${since}`}
                        {since != null && committees.length > 0 && ' · '}
                        {committees.length > 0 && committees.join(', ')}
                      </Text>
                    )}
                  </Stack>
                </Card>
              )
            })}
          </SimpleGrid>
        </Stack>
      )}
    </Stack>
  )
}
