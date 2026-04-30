import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Group,
  List,
  Loader,
  Progress,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { extractErrorMessage, fetchWithRetry } from '@younionize/api-client'
import type { Director, Executive } from '~/lib/exec-types'
import {
  formatDollarsCompact,
  formatDollarsFull,
  getInitials,
} from '~/lib/format'
import { CompensationExplanation } from '~/components/CompensationExplanation'

interface CompanyInfo {
  id: string
  ticker: string
  name: string
  sector: string | null
}

interface DetailResponse {
  company: CompanyInfo
  executives: Array<Executive>
  directors: Array<Director>
}

type PersonKind = 'executive' | 'director' | 'both'

interface ResolvedPerson {
  kind: PersonKind
  executive: Executive | null
  director: Director | null
  name: string
  title: string
}

function resolvePerson(
  data: DetailResponse,
  id: string,
): ResolvedPerson | null {
  const exec = data.executives.find((e) => e.id === id) ?? null
  const dir = data.directors.find((d) => d.id === id) ?? null
  if (!exec && !dir) return null

  // A person may be both an executive and a director — cross-match by name.
  const name = exec?.name ?? dir?.name ?? ''
  const matchedDir = dir ?? data.directors.find((d) => d.name === name) ?? null
  const matchedExec =
    exec ?? data.executives.find((e) => e.name === name) ?? null

  const kind: PersonKind =
    matchedExec && matchedDir ? 'both' : matchedExec ? 'executive' : 'director'

  return {
    kind,
    executive: matchedExec,
    director: matchedDir,
    name,
    title: exec?.title ?? dir?.title ?? '',
  }
}

export function ExecutivePage() {
  const { ticker: tickerParam, id } = useParams<{
    ticker: string
    id: string
  }>()
  const navigate = useNavigate()
  const ticker = tickerParam?.toUpperCase() ?? ''
  const personId = id ?? ''

  const [data, setData] = useState<DetailResponse | null>(null)
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
        setData((await res.json()) as DetailResponse)
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
          <Text c="slate.7">Loading profile…</Text>
        </Stack>
      </Center>
    )
  }

  if (error || !data) {
    return (
      <Container size="md" py="xl">
        <Alert color="red" title="Could not load profile">
          {error ?? 'No data returned for this person.'}
        </Alert>
        <Group mt="md">
          <Button
            variant="default"
            onClick={() => navigate(`/companies/${ticker}`)}
          >
            Back to {ticker}
          </Button>
        </Group>
      </Container>
    )
  }

  const person = resolvePerson(data, personId)
  if (!person) {
    return (
      <Container size="md" py="xl">
        <Alert color="orange" title="Person not found">
          We couldn't find that executive or director on the latest filing
          for {data.company.name}.
        </Alert>
        <Group mt="md">
          <Button
            variant="default"
            onClick={() => navigate(`/companies/${ticker}`)}
          >
            Back to {data.company.name}
          </Button>
        </Group>
      </Container>
    )
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Anchor
          component={Link}
          to={`/companies/${ticker}`}
          size="sm"
        >
          ← Back to {data.company.name}
        </Anchor>

        <Group gap="md" align="flex-start">
          <Avatar size="xl" color="navy" radius="xl">
            {getInitials(person.name)}
          </Avatar>
          <Stack gap={2} flex={1}>
            <Title order={1} c="navy.6">
              {person.name}
            </Title>
            <Text c="slate.7">{person.title}</Text>
            <Group gap="xs" mt={4}>
              <Badge color="navy" variant="light" size="sm">
                {person.kind === 'both'
                  ? 'Executive · Director'
                  : person.kind === 'executive'
                    ? 'Executive'
                    : 'Director'}
              </Badge>
              <Text size="xs" c="slate.7">
                {data.company.name} · {data.company.ticker}
              </Text>
            </Group>
          </Stack>
        </Group>

        {person.director && <DirectorTenureCard director={person.director} />}

        {person.director && (
          <CommitteesCard director={person.director} />
        )}

        {person.executive && (
          <CompensationCard executive={person.executive} />
        )}

        {person.executive && <CompensationExplanation />}

        {person.director && (
          <QualificationsCard director={person.director} />
        )}
      </Stack>
    </Container>
  )
}

function DirectorTenureCard({ director }: { director: Director }) {
  const tenureYear = director.tenureStart
    ? Number(director.tenureStart.slice(0, 4))
    : null
  const hasTenure = tenureYear != null && !Number.isNaN(tenureYear)
  if (!hasTenure && !director.isIndependent && !director.role) return null

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="xs">
        <Title order={4}>Board Service</Title>
        <Group gap="xs" wrap="wrap">
          {hasTenure && (
            <Badge color="slate" variant="light">
              Director since {tenureYear}
            </Badge>
          )}
          {director.age != null && (
            <Badge color="slate" variant="light">
              Age {director.age}
            </Badge>
          )}
          {director.directorClass && (
            <Badge color="slate" variant="light">
              {director.directorClass}
            </Badge>
          )}
          {director.isIndependent != null && (
            <Badge
              color={director.isIndependent ? 'green' : 'slate'}
              variant="light"
            >
              {director.isIndependent
                ? 'Independent'
                : 'Non-Independent'}
            </Badge>
          )}
          {director.role && (
            <Badge color="navy" variant="light">
              {director.role}
            </Badge>
          )}
        </Group>
      </Stack>
    </Card>
  )
}

function CommitteesCard({ director }: { director: Director }) {
  const committees = Array.isArray(director.committees)
    ? (director.committees as Array<string>)
    : []
  if (committees.length === 0) return null

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="sm">
        <Title order={4}>Committee Memberships</Title>
        <List size="sm" spacing={4}>
          {committees.map((c) => (
            <List.Item key={c}>{c}</List.Item>
          ))}
        </List>
      </Stack>
    </Card>
  )
}

function CompensationCard({ executive }: { executive: Executive }) {
  const lineItems: Array<{
    label: string
    value: number | null
    color: string
  }> = [
    { label: 'Base Salary', value: executive.salary, color: 'navy.6' },
    { label: 'Bonus', value: executive.bonus, color: 'navy.4' },
    { label: 'Stock Awards', value: executive.stockAwards, color: 'green.6' },
    { label: 'Option Awards', value: executive.optionAwards, color: 'green.4' },
    {
      label: 'Non-Equity Incentive',
      value: executive.nonEquityIncentive,
      color: 'navy.7',
    },
    {
      label: 'Change in Pension Value',
      value: executive.changeInPensionValue,
      color: 'slate.5',
    },
    {
      label: 'Other Compensation (perks)',
      value: executive.otherCompensation,
      color: 'orange.5',
    },
  ]

  const nonZero = lineItems.filter((i) => i.value != null && i.value > 0)
  const total = executive.totalCompensation || 1

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={3}>Compensation Breakdown</Title>
            <Text size="xs" c="slate.7">
              FY {executive.fiscalYear}
            </Text>
          </div>
          <Stack gap={0} align="flex-end">
            <Text size="xs" c="slate.7">
              Total
            </Text>
            <Text fw={700} size="xl" c="navy.8">
              {formatDollarsFull(executive.totalCompensation)}
            </Text>
          </Stack>
        </Group>

        {nonZero.length > 0 && (
          <Progress.Root size="lg" radius="md">
            {nonZero.map((item) => (
              <Progress.Section
                key={item.label}
                value={((item.value ?? 0) / total) * 100}
                color={item.color}
              />
            ))}
          </Progress.Root>
        )}

        <Table verticalSpacing="xs" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Component</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
              <Table.Th ta="right">% of Total</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lineItems.map((item) => {
              const pct =
                executive.totalCompensation > 0 && item.value != null
                  ? ((item.value / executive.totalCompensation) * 100).toFixed(1)
                  : null
              return (
                <Table.Tr key={item.label}>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          backgroundColor: `var(--mantine-color-${item.color.replace('.', '-')})`,
                        }}
                      />
                      <Text size="sm">{item.label}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" ff="monospace">
                      {formatDollarsCompact(item.value)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="slate.7">
                      {pct != null ? `${pct}%` : '–'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>

        {executive.ceoPayRatio && (
          <>
            <Divider />
            <Group justify="space-between">
              <Text size="sm" c="slate.7">
                CEO-to-Median-Worker Pay Ratio
              </Text>
              <Text fw={700} c="navy.8">
                {executive.ceoPayRatio}:1
              </Text>
            </Group>
          </>
        )}
      </Stack>
    </Card>
  )
}

function QualificationsCard({ director }: { director: Director }) {
  const quals = director.qualifications
  if (!quals) return null
  let content: string
  if (typeof quals === 'string') content = quals
  else if (Array.isArray(quals))
    content = (quals as Array<string>).join('\n\n')
  else return null
  if (!content.trim()) return null

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="sm">
        <Title order={4}>Background &amp; Qualifications</Title>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {content}
        </Text>
      </Stack>
    </Card>
  )
}
