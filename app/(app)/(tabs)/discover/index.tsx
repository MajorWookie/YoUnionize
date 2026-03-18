import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { H2, H4, Input, Paragraph, Separator, Spinner, XStack, YStack } from 'tamagui'
import { useDebounce } from '@union/hooks'
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

export default function DiscoverScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<SearchResult>>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const debouncedQuery = useDebounce(query, 300)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([])
      setHasSearched(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/companies/search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      setResults(data.results ?? [])
      setHasSearched(true)
    } catch {
      setResults([])
      setHasSearched(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    search(debouncedQuery)
  }, [debouncedQuery, search])

  return (
    <ScreenContainer>
      <YStack gap="$2" marginBottom="$3">
        <H2>Discover</H2>
        <Paragraph color="$color8">
          Search public companies and explore their SEC filings.
        </Paragraph>
      </YStack>

      <XStack
        backgroundColor="$color2"
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderColor"
        alignItems="center"
        paddingHorizontal="$3"
        marginBottom="$3"
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
      <YStack marginBottom="$3" gap="$2">
        <H4>Ask about any company</H4>
        <AskBar placeholder="Ask anything about any public company..." />
      </YStack>

      <Separator marginBottom="$3" />

      {!hasSearched && query.length === 0 ? (
        <EmptyState
          icon={<DiscoverIcon size={48} color="var(--color8)" />}
          title="Search for a company"
          description="Look up any public company by name or ticker to see their financial filings, executive compensation, and more."
        />
      ) : results.length === 0 && hasSearched && !loading ? (
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
              <XStack justifyContent="space-between" alignItems="center">
                <YStack flex={1} gap={2}>
                  <Paragraph fontWeight="600" fontSize={16} numberOfLines={1}>
                    {company.name}
                  </Paragraph>
                  <XStack gap="$2" alignItems="center">
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
        </YStack>
      )}
    </ScreenContainer>
  )
}
