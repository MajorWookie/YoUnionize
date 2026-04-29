import { Container, Stack, Text, Title } from '@mantine/core'
import { useParams } from 'react-router-dom'

// Stub route — full dashboard (charts, markdown summaries, leadership) ships in
// the next PR. Search results from /discover land here so the click target is
// not a 404.
export function CompanyPage() {
  const { ticker } = useParams<{ ticker: string }>()

  return (
    <Container size="md" py="xl">
      <Stack gap="md">
        <Title order={1} c="navy.6">
          {ticker?.toUpperCase()}
        </Title>
        <Text c="slate.7">
          Company dashboard is coming next. This page will render the financial
          summary, leadership, and AI-generated commentary for{' '}
          <Text span fw={600}>
            {ticker?.toUpperCase()}
          </Text>
          .
        </Text>
      </Stack>
    </Container>
  )
}
