import { useState } from 'react'
import { Button, Code, Container, Stack, Text, Title } from '@mantine/core'
import { fetchWithRetry } from '@younionize/api-client'
import { useAuth } from '@younionize/hooks'

export function HomePage() {
  const { user } = useAuth()
  const [response, setResponse] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const ping = async () => {
    setLoading(true)
    try {
      const res = await fetchWithRetry('/api/health')
      const text = await res.text()
      setResponse(`${res.status} ${res.statusText}\n${text}`)
    } catch (err) {
      setResponse(`Error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Title order={1} c="navy.6">
          Hello YoUnion
        </Title>
        <Text>
          Web scaffold smoke test. Auth context user:{' '}
          <Code>{user?.email ?? 'no user'}</Code>
        </Text>
        <Button onClick={ping} loading={loading} w="fit-content">
          Ping /api/health
        </Button>
        {response && <Code block>{response}</Code>}
      </Stack>
    </Container>
  )
}
