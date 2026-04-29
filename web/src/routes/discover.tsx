import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDebounce } from '@younionize/hooks'
import { fetchWithRetry } from '@younionize/api-client'

interface SearchResult {
  name: string
  ticker: string
  exchange: string
  sector: string
  industry: string
}

function mergeResults(
  local: Array<SearchResult>,
  sec: Array<SearchResult>,
): Array<SearchResult> {
  const seen = new Set(local.map((r) => r.ticker))
  return [...local, ...sec.filter((r) => !seen.has(r.ticker))].slice(0, 15)
}

export function DiscoverPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<SearchResult>>([])
  const [loading, setLoading] = useState(false)
  const [secLoading, setSecLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [secSearched, setSecSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Discard stale SEC results that arrive after a newer local query has fired.
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
        const message = err instanceof Error ? err.message : 'Network request failed'
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

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Stack gap="xs">
          <Title order={1} c="navy.6">
            Discover
          </Title>
          <Text c="slate.7">
            Search public companies and explore their SEC filings.
          </Text>
        </Stack>

        <TextInput
          placeholder="Search by company name or ticker..."
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          autoComplete="off"
          autoCorrect="off"
          rightSection={loading ? <Loader size="xs" /> : null}
          size="md"
        />

        {searchError ? (
          <Alert color="red" variant="light" title="Search unavailable">
            {searchError}
          </Alert>
        ) : !hasSearched && query.length === 0 ? (
          <Center py="xl">
            <Stack gap="xs" align="center" maw={420} ta="center">
              <Text fw={600}>Search for a company</Text>
              <Text size="sm" c="slate.7">
                Look up any public company by name or ticker to see their
                financial filings, executive compensation, and more.
              </Text>
            </Stack>
          </Center>
        ) : showNoResults ? (
          <Center py="xl">
            <Stack gap="xs" align="center" maw={420} ta="center">
              <Text fw={600}>No results found</Text>
              <Text size="sm" c="slate.7">
                No companies match &ldquo;{query}&rdquo;. Try a different name
                or ticker symbol.
              </Text>
            </Stack>
          </Center>
        ) : (
          <Stack gap="xs">
            {results.map((company) => (
              <Card
                key={company.ticker}
                withBorder
                padding="md"
                radius="md"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/companies/${company.ticker}`)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                    <Text fw={600} size="md" lineClamp={1}>
                      {company.name}
                    </Text>
                    <Group gap="xs">
                      <Text fw={700} c="navy.6" size="sm">
                        {company.ticker}
                      </Text>
                      {company.exchange && (
                        <Text c="slate.6" size="xs">
                          {company.exchange}
                        </Text>
                      )}
                    </Group>
                    {company.sector && (
                      <Text c="slate.7" size="xs" lineClamp={1}>
                        {company.sector}
                        {company.industry ? ` · ${company.industry}` : ''}
                      </Text>
                    )}
                  </Stack>
                  <Text c="slate.6" size="lg">
                    ›
                  </Text>
                </Group>
              </Card>
            ))}

            {secLoading && (
              <Group gap="xs" justify="center" py="xs">
                <Loader size="xs" />
                <Text size="sm" c="slate.6">
                  Searching more companies...
                </Text>
              </Group>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
