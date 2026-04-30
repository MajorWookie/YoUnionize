import { Stack, Text, Title } from '@mantine/core'
import { TextSummaryCard } from '~/components/TextSummaryCard'
import { asString } from '~/lib/summary-helpers'
import { formatDate } from '~/lib/format'

export interface RecentEvent {
  id: string
  filedAt: string
  summary: Record<string, unknown>
}

interface Props {
  events: Array<RecentEvent>
}

export function RecentEventsList({ events }: Props) {
  if (events.length === 0) return null
  return (
    <Stack gap="md">
      <Title order={3}>Recent 8-K Events</Title>
      {events.map((event) => {
        const eventText = asString(event.summary?.event_summary)
        // Skip events with no AI-generated summary — the date alone isn't
        // enough context to render a card for.
        if (!eventText) return null
        return (
          <TextSummaryCard
            key={event.id}
            title={`8-K · ${formatDate(event.filedAt)}`}
            content={eventText}
            maxHeight={180}
          />
        )
      })}
      {events.every((e) => !asString(e.summary?.event_summary)) && (
        <Text size="sm" c="slate.6" ta="center">
          No event summaries available yet.
        </Text>
      )}
    </Stack>
  )
}
