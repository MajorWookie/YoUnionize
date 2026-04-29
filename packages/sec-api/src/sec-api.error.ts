/**
 * Strip the `token=...` query parameter from a sec-api.io URL so the API key
 * never leaks into error messages, logs, or DB rows.
 *
 * Real bug found 2026-04-29: 154 rows of filing_sections.fetch_error stored
 * the full extractor URL — including ?token=<key> — when sec-api returned
 * 429. Anyone with read on filing_sections could lift the key. Fix is
 * defence-in-depth: redact at the error boundary, not at every call site.
 */
export function sanitizeSecApiUrl(url: string): string {
  return url.replace(/([?&])token=[^&#]*/g, '$1token=[REDACTED]')
}

export class SecApiError extends Error {
  readonly statusCode: number
  readonly responseBody: string
  readonly url: string

  constructor(statusCode: number, responseBody: string, url: string) {
    const safeUrl = sanitizeSecApiUrl(url)
    super(`SEC API request failed: ${statusCode} ${safeUrl}`)
    this.name = 'SecApiError'
    this.statusCode = statusCode
    this.responseBody = responseBody
    this.url = safeUrl
  }
}
