/**
 * Pure helpers used by `raw-data-processor.ts`. Kept in a separate file so
 * the unit tests can import them without pulling in the workspace database
 * package (`@union/postgres`), which Vitest can't resolve here.
 */

/**
 * Splits a section sub_key of the form "{accessionNo}:{sectionCode}".
 * Uses indexOf rather than split so a section_code containing ':' would
 * still be parsed correctly (none in current enums, but defensive).
 */
export function parseSectionSubKey(
  subKey: string | null,
): { accessionNo: string; sectionCode: string } | null {
  if (!subKey) return null
  const colonIdx = subKey.indexOf(':')
  if (colonIdx < 0) return null
  const accessionNo = subKey.slice(0, colonIdx)
  const sectionCode = subKey.slice(colonIdx + 1)
  if (!accessionNo || !sectionCode) return null
  return { accessionNo, sectionCode }
}

/**
 * Derives the persisted filing_sections.fetch_status from the upstream
 * raw_sec_responses status and the section body. Three distinct states:
 *
 * - 'error':   upstream sec-api call rejected (network / 5xx / etc.) OR the
 *              body is the literal string "processing" (sec-api.io's async-
 *              extraction placeholder). The `SecApiClient.extractSection`
 *              polling guard normally swallows this, but we double-check
 *              here so the placeholder never lands as a "successful 10-char
 *              section" if a future code path bypasses the client.
 * - 'empty':   call succeeded but returned no text (item not in this
 *              filing). Whitespace-only bodies count as empty too.
 * - 'success': call succeeded with non-empty, non-placeholder text.
 *
 * The previous JSON-blob storage conflated 'error' and 'empty' as "missing
 * key", which is why failed extractions were invisible to operators.
 */
export function deriveSectionStatus(
  upstreamFetchStatus: string,
  text: string | null,
): 'success' | 'empty' | 'error' {
  if (upstreamFetchStatus === 'error') return 'error'
  if (!text) return 'empty'
  const trimmed = text.trim()
  if (trimmed.length === 0) return 'empty'
  if (trimmed.toLowerCase() === 'processing') return 'error'
  return 'success'
}
