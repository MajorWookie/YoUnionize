import { Anchor, Avatar, Badge, Card, Group, Spoiler, Stack, Text, Title } from '@mantine/core'
import { MarkdownContent } from '~/components/MarkdownContent'
import { Eyebrow } from '~/components/primitives'
import { formatDate, formatRelativeTime } from '~/lib/format'
import { getEightKItemDisplay } from '~/lib/eight-k-items'

export interface RecentEvent {
  id: string
  filedAt: string
  itemType: string
  accessionNumber: string
  cik: string
  summary: {
    headline?: string | null
    event_summary?: string | null
  }
}

interface Props {
  events: ReadonlyArray<RecentEvent>
}

const SERIF_HEADLINE: React.CSSProperties = {
  fontFamily: '"Source Serif 4 Variable", Charter, Georgia, serif',
}

/**
 * Build the EDGAR archive index URL for a single filing. The accession
 * number on disk has no dashes; the on-screen format does. Example:
 *   accession: "0001193125-26-012345" + cik: "1318605"
 *   → https://www.sec.gov/Archives/edgar/data/1318605/000119312526012345/
 */
function edgarFilingUrl(cik: string, accessionNumber: string): string {
  const cleanCik = cik.replace(/^0+/, '') || '0'
  const noDashes = accessionNumber.replace(/-/g, '')
  return `https://www.sec.gov/Archives/edgar/data/${cleanCik}/${noDashes}/`
}

export function EightKFeed({ events }: Props) {
  if (events.length === 0) {
    return (
      <Text size="sm" c="slate.6" ta="center">
        No event summaries available yet.
      </Text>
    )
  }

  return (
    <Stack gap="sm">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </Stack>
  )
}

function EventCard({ event }: { event: RecentEvent }) {
  const display = getEightKItemDisplay(event.itemType)
  const Icon = display.icon
  const headline = event.summary.headline?.trim() || display.label
  const body = event.summary.event_summary?.trim() ?? ''

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Avatar color={display.color} radius="xl" size="md">
              <Icon size={18} />
            </Avatar>
            <Stack gap={2}>
              <Eyebrow>{display.chipLabel}</Eyebrow>
              <Text size="xs" c="slate.6">
                {formatRelativeTime(event.filedAt)}
              </Text>
            </Stack>
          </Group>
          <Badge color={display.color} variant="light" radius="sm">
            8-K
          </Badge>
        </Group>

        <Title order={4} c="navy.8" style={SERIF_HEADLINE}>
          {headline}
        </Title>

        {body && (
          <Spoiler maxHeight={96} showLabel="Read more" hideLabel="Collapse">
            <MarkdownContent>{body}</MarkdownContent>
          </Spoiler>
        )}

        <Group justify="space-between" gap="sm">
          <Text size="xs" c="slate.6">
            Filed {formatDate(event.filedAt)}
          </Text>
          <Anchor
            href={edgarFilingUrl(event.cik, event.accessionNumber)}
            target="_blank"
            rel="noreferrer"
            size="xs"
            c="navy.7"
          >
            View source filing →
          </Anchor>
        </Group>
      </Stack>
    </Card>
  )
}
