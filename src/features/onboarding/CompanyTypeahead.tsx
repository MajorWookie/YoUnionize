import { useState, useEffect, useCallback } from 'react'
import { Input, Paragraph, XStack, YStack } from 'tamagui'
import { useDebounce } from '@younionize/hooks'
import { fetchWithRetry } from '@younionize/api-client'
import { Card } from '~/interface/display/Card'

interface CompanyResult {
  name: string
  ticker: string
  exchange: string
}

interface CompanyTypeaheadProps {
  value: string | null | undefined
  onSelect: (ticker: string, name: string) => void
  disabled?: boolean
}

export function CompanyTypeahead({ value, onSelect, disabled }: CompanyTypeaheadProps) {
  const [query, setQuery] = useState(value ?? '')
  const [results, setResults] = useState<Array<CompanyResult>>([])
  const [showResults, setShowResults] = useState(false)
  const [selectedName, setSelectedName] = useState('')

  const debouncedQuery = useDebounce(query, 300)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([])
      return
    }
    try {
      const res = await fetchWithRetry(`/api/companies/search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      setResults(data.results ?? [])
      setShowResults(true)
    } catch {
      setResults([])
    }
  }, [])

  useEffect(() => {
    if (debouncedQuery && debouncedQuery !== selectedName) {
      search(debouncedQuery)
    }
  }, [debouncedQuery, search, selectedName])

  const handleSelect = (company: CompanyResult) => {
    setQuery(`${company.name} (${company.ticker})`)
    setSelectedName(`${company.name} (${company.ticker})`)
    setShowResults(false)
    setResults([])
    onSelect(company.ticker, company.name)
  }

  return (
    <YStack gap="$1">
      <Paragraph fontSize={14} fontWeight="500" color="$color11">
        Company
      </Paragraph>
      <Input
        value={query}
        onChangeText={(text) => {
          setQuery(text)
          if (text !== selectedName) {
            setShowResults(true)
          }
        }}
        placeholder="Search by company name or ticker..."
        disabled={disabled}
        autoCapitalize="none"
        backgroundColor="$color2"
        borderColor="$borderColor"
      />
      {showResults && results.length > 0 && (
        <Card p="$0">
          {results.slice(0, 5).map((company) => (
            <XStack
              key={company.ticker}
              p="$3"
              cursor="pointer"
              hoverStyle={{ background: '$backgroundHover' }}
              pressStyle={{ background: '$backgroundPress' }}
              onPress={() => handleSelect(company)}
              borderBottomWidth={1}
              borderBottomColor="$color3"
            >
              <YStack flex={1}>
                <Paragraph fontSize={14} fontWeight="500">
                  {company.name}
                </Paragraph>
                <XStack gap="$2">
                  <Paragraph fontSize={12} fontWeight="700" color="$color9">
                    {company.ticker}
                  </Paragraph>
                  {company.exchange && (
                    <Paragraph fontSize={12} color="$color7">
                      {company.exchange}
                    </Paragraph>
                  )}
                </XStack>
              </YStack>
            </XStack>
          ))}
        </Card>
      )}
    </YStack>
  )
}
