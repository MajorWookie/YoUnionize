import { useCallback, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconSparkles } from '@tabler/icons-react'
import { extractErrorMessage, fetchWithRetry } from '@younionize/api-client'
import { MarkdownContent } from '~/components/MarkdownContent'
import { Eyebrow } from '~/components/primitives'

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
    <Stack gap="md">
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
          size="md"
          style={{ flex: 1 }}
          leftSection={<IconSparkles size={16} stroke={1.6} />}
        />
        <Button
          onClick={ask}
          loading={loading}
          disabled={!question.trim()}
          size="md"
        >
          Ask
        </Button>
      </Group>

      {error ? <Alert color="red">{error}</Alert> : null}

      {answer ? (
        <Card>
          <Stack gap="md">
            <MarkdownContent>{answer}</MarkdownContent>
            {sources.length > 0 ? (
              <>
                <Divider />
                <Stack gap="xs">
                  <Eyebrow>Sources</Eyebrow>
                  <Stack gap={4}>
                    {sources.map((src, idx) => (
                      <Group key={idx} gap="xs" wrap="nowrap" align="baseline">
                        <Text size="xs" fw={600} c="navy.7">
                          {idx + 1}.
                        </Text>
                        <Text size="xs" c="dimmed">
                          <Text component="span" fw={600} c="navy.7">
                            {src.companyTicker}
                          </Text>{' '}
                          {src.filingType} · {formatSection(src.section)}
                          {src.periodEnd ? ` (${src.periodEnd})` : ''}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Stack>
              </>
            ) : null}
          </Stack>
        </Card>
      ) : null}
    </Stack>
  )
}

function formatSection(section: string): string {
  return section.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
