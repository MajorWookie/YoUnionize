import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Badge,
  Card,
  Container,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconArrowRight, IconSearch } from '@tabler/icons-react'
import { useDebounce } from '@younionize/hooks'
import { fetchWithRetry } from '@younionize/api-client'
import { AskBar } from '~/components/AskBar'
import {
  EmptyState,
  Eyebrow,
  PageHeader,
  SectionHeader,
} from '~/components/primitives'
import cardClasses from '~/theme/Card.module.css'

interface SearchResult {
  name: string
  ticker: string
  exchange: string
  sector: string
  industry: string
}

type Mode = 'browse' | 'ask'

interface FeaturedStory {
  eyebrow: string
  headline: string
  subhead: string
  ticker: string
}

// Hand-curated stories shown when the user lands on Discover with no query.
// Edit freely — these are editorial entry points, not derived from any API.
const FEATURED_STORIES: ReadonlyArray<FeaturedStory> = [
  {
    eyebrow: 'Pay ratio',
    headline: "Oracle's executive pay, in context",
    subhead:
      'How a tenured leadership team is compensated — equity, salary, and the gap to the median worker.',
    ticker: 'ORCL',
  },
  {
    eyebrow: 'Stock-heavy',
    headline: "Tesla's equity-driven compensation",
    subhead:
      "Why Tesla's CEO comp swings hardest with the share price — and what shareholders are voting on.",
    ticker: 'TSLA',
  },
  {
    eyebrow: 'Big tech',
    headline: "Amazon's leadership pay",
    subhead:
      'Cash, equity, and the gap between executives and the typical Amazon employee.',
    ticker: 'AMZN',
  },
  {
    eyebrow: 'Governance',
    headline: "Meta's executive compensation",
    subhead:
      'How performance, tenure, and equity grants shape what leadership takes home.',
    ticker: 'META',
  },
]

function mergeResults(
  local: Array<SearchResult>,
  sec: Array<SearchResult>,
): Array<SearchResult> {
  const seen = new Set(local.map((r) => r.ticker))
  return [...local, ...sec.filter((r) => !seen.has(r.ticker))].slice(0, 15)
}

export function DiscoverPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('browse')

  // Browse state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<SearchResult>>([])
  const [loading, setLoading] = useState(false)
  const [secLoading, setSecLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [secSearched, setSecSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const latestQueryRef = useRef('')
  const debouncedQuery = useDebounce(query, 300)

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 1) {
      setResults([])
      setHasSearched(false)
      setSecSearched(false)
      setSecLoading(false)
      setSearchError(null)
      return
    }

    latestQueryRef.current = trimmed
    setLoading(true)
    setSecSearched(false)
    setSearchError(null)

    try {
      const res = await fetchWithRetry(
        `/api/companies/search?q=${encodeURIComponent(trimmed)}`,
      )

      if (!res.ok) {
        if (latestQueryRef.current !== trimmed) return
        const statusMsg =
          res.status === 401 || res.status === 403
            ? 'Unable to connect — check your Supabase API key configuration.'
            : `Search failed (${res.status}). Please try again.`
        setSearchError(statusMsg)
        setResults([])
        setHasSearched(true)
        setSecSearched(true)
        setLoading(false)
        return
      }

      const data = await res.json()
      const localResults: Array<SearchResult> = data.results ?? []
      if (latestQueryRef.current !== trimmed) return

      setResults(localResults)
      setHasSearched(true)
      setLoading(false)

      if (localResults.length < 3) {
        setSecLoading(true)
        try {
          const secRes = await fetchWithRetry(
            `/api/companies/search-sec?q=${encodeURIComponent(trimmed)}`,
          )
          if (secRes.ok) {
            const secData = await secRes.json()
            const secResults: Array<SearchResult> = secData.results ?? []
            if (latestQueryRef.current === trimmed && secResults.length > 0) {
              setResults((prev) => mergeResults(prev, secResults))
            }
          }
        } catch {
          // SEC search failure is non-fatal — local results are already shown.
        } finally {
          if (latestQueryRef.current === trimmed) {
            setSecLoading(false)
            setSecSearched(true)
          }
        }
      } else {
        setSecSearched(true)
      }
    } catch (err) {
      if (latestQueryRef.current === trimmed) {
        const message =
          err instanceof Error ? err.message : 'Network request failed'
        setSearchError(`Could not reach the server. ${message}`)
        setResults([])
        setHasSearched(true)
        setSecSearched(true)
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    search(debouncedQuery)
  }, [debouncedQuery, search])

  const showNoResults =
    hasSearched &&
    secSearched &&
    results.length === 0 &&
    !loading &&
    !secLoading &&
    !searchError

  const goToCompany = (ticker: string) => navigate(`/companies/${ticker}`)

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <PageHeader
          title="Discover"
          description="Browse public companies or ask questions about their SEC filings — pay, financials, leadership."
        />

        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          data={[
            { label: 'Browse companies', value: 'browse' },
            { label: 'Ask a question', value: 'ask' },
          ]}
          fullWidth
          size="md"
        />

        {mode === 'browse' ? (
          <Stack gap="md">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search by company name or ticker…"
              autoComplete="off"
              autoCorrect="off"
              size="md"
              leftSection={<IconSearch size={16} stroke={1.6} />}
              rightSection={loading ? <Loader size="xs" /> : null}
            />

            {searchError ? (
              <Alert color="red" variant="light" title="Search unavailable">
                {searchError}
              </Alert>
            ) : !hasSearched && query.length === 0 ? (
              <Stack gap="md">
                <SectionHeader
                  title="Featured stories"
                  description="A few entry points for exploring how public companies pay their leadership."
                />
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {FEATURED_STORIES.map((story) => (
                    <Card
                      key={story.ticker}
                      className={cardClasses.interactive}
                      role="button"
                      tabIndex={0}
                      onClick={() => goToCompany(story.ticker)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          goToCompany(story.ticker)
                        }
                      }}
                    >
                      <Stack gap="xs">
                        <Eyebrow>{story.eyebrow}</Eyebrow>
                        <Text fz="lg" fw={600} lh={1.3}>
                          {story.headline}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {story.subhead}
                        </Text>
                        <Group gap={4} mt="xs" c="navy.7" align="center">
                          <Text size="xs" fw={600}>
                            Read story
                          </Text>
                          <IconArrowRight size={12} stroke={2} />
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              </Stack>
            ) : showNoResults ? (
              <EmptyState
                title="No results"
                description={`No companies match "${query.trim()}". Try a different name or ticker.`}
              />
            ) : (
              <Stack gap="sm">
                {results.map((company) => (
                  <Card
                    key={company.ticker}
                    className={cardClasses.interactive}
                    role="button"
                    tabIndex={0}
                    onClick={() => goToCompany(company.ticker)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        goToCompany(company.ticker)
                      }
                    }}
                  >
                    <Stack gap={6}>
                      {company.sector ? (
                        <Eyebrow>
                          {company.sector}
                          {company.industry ? ` · ${company.industry}` : ''}
                        </Eyebrow>
                      ) : null}
                      <Group justify="space-between" wrap="nowrap" align="center" gap="md">
                        <Text fw={600} size="md" lineClamp={1} style={{ flex: 1 }}>
                          {company.name}
                        </Text>
                        <Group gap="xs" align="center" wrap="nowrap">
                          <Badge color="navy" variant="light">
                            {company.ticker}
                          </Badge>
                          {company.exchange ? (
                            <Text c="dimmed" size="xs">
                              {company.exchange}
                            </Text>
                          ) : null}
                        </Group>
                      </Group>
                    </Stack>
                  </Card>
                ))}

                {secLoading ? (
                  <Group gap="xs" justify="center" py="xs">
                    <Loader size="xs" />
                    <Text size="sm" c="dimmed">
                      Searching SEC for more…
                    </Text>
                  </Group>
                ) : null}
              </Stack>
            )}
          </Stack>
        ) : (
          <AskBar placeholder="Ask about any public company…" />
        )}
      </Stack>
    </Container>
  )
}
