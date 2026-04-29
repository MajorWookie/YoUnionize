import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'expo-router'
import { H2, H4, Input, Paragraph, Separator, Spinner, XStack, YStack } from 'tamagui'
import { useDebounce } from '@younionize/hooks'
import { fetchWithRetry } from '@younionize/api-client'
import { ScreenContainer } from '~/interface/layout/ScreenContainer'
import { Card } from '~/interface/display/Card'
import { EmptyState } from '~/interface/display/EmptyState'
import { DiscoverIcon } from '~/interface/icons/TabIcons'
import { AskBar } from '~/features/ask/AskBar'

interface SearchResult {
  name: string
  ticker: string
  exchange: string
  sector: string
  industry: string
}

/** Merge two result arrays, deduplicating by ticker. Local results take priority. */
function mergeResults(local: Array<SearchResult>, sec: Array<SearchResult>): Array<SearchResult> {
  const seen = new Set(local.map((r) => r.ticker))
  return [...local, ...sec.filter((r) => !seen.has(r.ticker))].slice(0, 15)
}

export default function DiscoverScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<SearchResult>>([])
  const [loading, setLoading] = useState(false)
  const [secLoading, setSecLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [secSearched, setSecSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Track the latest search query to avoid stale SEC results overwriting newer local results
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
      // 1. Local DB search (fast)
      const res = await fetchWithRetry(`/api/companies/search?q=${encodeURIComponent(trimmed)}`)

      if (!res.ok) {
        if (latestQueryRef.current !== trimmed) return
        const statusMsg = res.status === 401 || res.status === 403
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

      // Only update if this is still the latest query
      if (latestQueryRef.current !== trimmed) return

      setResults(localResults)
      setHasSearched(true)
      setLoading(false)

      // 2. SEC API search (slower) — only if local results are sparse
      if (localResults.length < 3) {
        setSecLoading(true)
        try {
          const secRes = await fetchWithRetry(`/api/companies/search-sec?q=${encodeURIComponent(trimmed)}`)

          if (secRes.ok) {
            const secData = await secRes.json()
            const secResults: Array<SearchResult> = secData.results ?? []

            // Only merge if this is still the latest query
            if (latestQueryRef.current === trimmed && secResults.length > 0) {
              setResults((prev) => mergeResults(prev, secResults))
            }
          }
        } catch {
          // SEC search failure is non-fatal — local results are already shown
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

  // Show "no results" only after both sources have been checked
  const showNoResults = hasSearched && secSearched && results.length === 0 && !loading && !secLoading && !searchError

  return (
    <ScreenContainer>
      <YStack gap="$2" mb="$3">
        <H2>Discover</H2>
        <Paragraph color="$color8">
          Search public companies and explore their SEC filings.
        </Paragraph>
      </YStack>

      <XStack
        bg="$color2"
        rounded="$3"
        borderWidth={1}
        borderColor="$borderColor"
        items="center"
        px="$3"
        mb="$3"
      >
        <DiscoverIcon size={18} color="var(--color7)" />
        <Input
          flex={1}
          placeholder="Search by company name or ticker..."
          value={query}
          onChangeText={setQuery}
          borderWidth={0}
          backgroundColor="transparent"
          placeholderTextColor="$placeholderColor"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading && <Spinner size="small" color="$color8" />}
      </XStack>

      {/* Global ask bar */}
      <YStack mb="$3" gap="$2">
        <H4>Ask about any company</H4>
        <AskBar placeholder="Ask anything about any public company..." />
      </YStack>

      <Separator mb="$3" />

      {searchError ? (
        <EmptyState
          title="Search unavailable"
          description={searchError}
        />
      ) : !hasSearched && query.length === 0 ? (
        <EmptyState
          icon={<DiscoverIcon size={48} color="var(--color8)" />}
          title="Search for a company"
          description="Look up any public company by name or ticker to see their financial filings, executive compensation, and more."
        />
      ) : showNoResults ? (
        <EmptyState
          title="No results found"
          description={`No companies match "${query}". Try a different name or ticker symbol.`}
        />
      ) : (
        <YStack gap="$2">
          {results.map((company) => (
            <Card
              key={company.ticker}
              pressable
              onPress={() => router.push(`/company/${company.ticker}` as never)}
            >
              <XStack justify="space-between" items="center">
                <YStack flex={1} gap={2}>
                  <Paragraph fontWeight="600" fontSize={16} numberOfLines={1}>
                    {company.name}
                  </Paragraph>
                  <XStack gap="$2" items="center">
                    <Paragraph fontWeight="700" color="$color9" fontSize={14}>
                      {company.ticker}
                    </Paragraph>
                    {company.exchange ? (
                      <Paragraph color="$color7" fontSize={12}>
                        {company.exchange}
                      </Paragraph>
                    ) : null}
                  </XStack>
                  {company.sector ? (
                    <Paragraph color="$color8" fontSize={12} numberOfLines={1}>
                      {company.sector}
                      {company.industry ? ` · ${company.industry}` : ''}
                    </Paragraph>
                  ) : null}
                </YStack>
                <Paragraph color="$color7" fontSize={18}>
                  {'\u203a'}
                </Paragraph>
              </XStack>
            </Card>
          ))}

          {secLoading && (
            <XStack gap="$2" items="center" justify="center" py="$2">
              <Spinner size="small" color="$color7" />
              <Paragraph color="$color7" fontSize={13}>
                Searching more companies...
              </Paragraph>
            </XStack>
          )}
        </YStack>
      )}
    </ScreenContainer>
  )
}
