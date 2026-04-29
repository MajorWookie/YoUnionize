import { useEffect, useState } from 'react'
import { Autocomplete } from '@mantine/core'
import { useDebounce } from '@younionize/hooks'
import { fetchWithRetry } from '@younionize/api-client'

interface CompanyResult {
  name: string
  ticker: string
}

interface Props {
  /** Currently selected ticker (informational — used only for the initial
   *  input value). Subsequent input edits are tracked locally. */
  value?: string
  /** Fired when the user picks an option from the dropdown. */
  onSelect: (ticker: string, name: string) => void
  disabled?: boolean
}

/**
 * Format used in the dropdown AND the input after selection. The leading
 * ticker is parsed back out by `extractTicker()` when the option is
 * picked. This keeps us on Mantine's string-based Autocomplete API
 * without reaching for the lower-level Combobox primitive.
 */
function formatOption(c: CompanyResult): string {
  return `${c.ticker} — ${c.name}`
}

function extractTicker(formatted: string): string | null {
  const match = formatted.match(/^([A-Z][A-Z0-9.\-]*)\s—/)
  return match ? match[1] : null
}

export function CompanyTypeahead({ value, onSelect, disabled }: Props) {
  const [query, setQuery] = useState(value ?? '')
  const [results, setResults] = useState<Array<CompanyResult>>([])
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (trimmed.length < 1) {
      setResults([])
      return
    }
    let cancelled = false
    fetchWithRetry(
      `/api/companies/search?q=${encodeURIComponent(trimmed)}`,
    )
      .then((res) => res.json())
      .then((data: { results?: Array<CompanyResult> }) => {
        if (cancelled) return
        setResults(data.results ?? [])
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  const handleSubmit = (selected: string) => {
    setQuery(selected)
    const ticker = extractTicker(selected)
    if (!ticker) return
    const company = results.find((r) => formatOption(r) === selected)
    onSelect(ticker, company?.name ?? '')
  }

  return (
    <Autocomplete
      label="Company"
      placeholder="Search by name or ticker…"
      value={query}
      onChange={setQuery}
      onOptionSubmit={handleSubmit}
      data={results.map(formatOption)}
      disabled={disabled}
      // Show all returned matches (Mantine's default filters client-side
      // which would hide our server-ranked results for typos like "appl"
      // matching "Apple Inc.").
      filter={({ options }) => options}
      comboboxProps={{ withinPortal: true }}
    />
  )
}
