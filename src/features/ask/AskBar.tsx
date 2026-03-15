import { useState, useCallback } from 'react'
import { Button, Input, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import { extractErrorMessage } from '~/lib/api-client'

interface Source {
  filingType: string
  section: string
  periodEnd: string | null
  companyTicker: string
  similarity: number
}

interface AskBarProps {
  /** If set, queries are scoped to this company */
  companyTicker?: string
  placeholder?: string
}

export function AskBar({
  companyTicker,
  placeholder = 'Ask a question...',
}: AskBarProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [sources, setSources] = useState<Array<Source>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ask = useCallback(async () => {
    if (!question.trim()) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    setSources([])

    try {
      const body: Record<string, string> = { question: question.trim() }
      if (companyTicker) {
        body.company_ticker = companyTicker
      }

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(extractErrorMessage(data))
        return
      }

      setAnswer(data.answer)
      setSources(data.sources ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [question, companyTicker])

  const handleSubmit = () => {
    ask()
  }

  return (
    <YStack gap="$3">
      <XStack gap="$2" alignItems="center">
        <Input
          flex={1}
          value={question}
          onChangeText={setQuestion}
          placeholder={placeholder}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          autoCapitalize="none"
          backgroundColor="$color2"
          borderColor="$borderColor"
          disabled={loading}
        />
        <Button
          theme="accent"
          onPress={handleSubmit}
          disabled={loading || !question.trim()}
        >
          {loading ? <Spinner size="small" /> : 'Ask'}
        </Button>
      </XStack>

      {error && (
        <Card>
          <Paragraph color="$negative" fontSize={13}>
            {error}
          </Paragraph>
        </Card>
      )}

      {answer && (
        <Card gap="$3">
          <Paragraph color="$color11" lineHeight={22}>
            {answer}
          </Paragraph>

          {sources.length > 0 && (
            <YStack gap="$1" marginTop="$1">
              <Paragraph fontSize={11} color="$color8" fontWeight="600">
                Sources
              </Paragraph>
              {sources.map((src, idx) => (
                <XStack key={idx} gap="$2" alignItems="center">
                  <Paragraph fontSize={11} color="$color7">
                    {src.companyTicker} {src.filingType}
                  </Paragraph>
                  <Paragraph fontSize={11} color="$color8">
                    {formatSectionName(src.section)}
                  </Paragraph>
                  {src.periodEnd && (
                    <Paragraph fontSize={11} color="$color7">
                      ({src.periodEnd})
                    </Paragraph>
                  )}
                </XStack>
              ))}
            </YStack>
          )}
        </Card>
      )}
    </YStack>
  )
}

function formatSectionName(section: string): string {
  return section
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
