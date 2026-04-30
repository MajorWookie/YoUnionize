import { useCallback, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { extractErrorMessage, fetchWithRetry } from '@younionize/api-client'

interface Source {
  filingType: string
  section: string
  periodEnd: string | null
  companyTicker: string
  similarity: number
}

interface Props {
  /** If set, the question is scoped to filings for this ticker. */
  companyTicker?: string
  placeholder?: string
}

export function AskBar({
  companyTicker,
  placeholder = 'Ask a question…',
}: Props) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [sources, setSources] = useState<Array<Source>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ask = useCallback(async () => {
    const trimmed = question.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    setSources([])
    try {
      const body: Record<string, string> = { question: trimmed }
      if (companyTicker) body.company_ticker = companyTicker

      const res = await fetchWithRetry('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(extractErrorMessage(data) || `Request failed (${res.status})`)
        return
      }
      setAnswer(data.answer ?? null)
      setSources(data.sources ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [question, companyTicker])

  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <TextInput
          value={question}
          onChange={(e) => setQuestion(e.currentTarget.value)}
          placeholder={placeholder}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ask()
            }
          }}
          style={{ flex: 1 }}
        />
        <Button onClick={ask} loading={loading} disabled={!question.trim()}>
          Ask
        </Button>
      </Group>

      {error && <Alert color="red">{error}</Alert>}

      {answer && (
        <Card withBorder padding="md">
          <Stack gap="md">
            <Text>{answer}</Text>
            {sources.length > 0 && (
              <Stack gap={2}>
                <Text size="xs" c="slate.7" fw={600}>
                  Sources
                </Text>
                {sources.map((src, idx) => (
                  <Text key={idx} size="xs" c="slate.6">
                    {src.companyTicker} {src.filingType} ·{' '}
                    {formatSection(src.section)}
                    {src.periodEnd ? ` (${src.periodEnd})` : ''}
                  </Text>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  )
}

function formatSection(section: string): string {
  return section.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
