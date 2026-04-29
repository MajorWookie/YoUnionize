import { describe, expect, it } from 'vitest'
import { deriveSectionStatus, parseSectionSubKey } from './raw-data-processor-helpers'

describe('parseSectionSubKey', () => {
  it('splits a well-formed sub_key into accessionNo and sectionCode', () => {
    expect(parseSectionSubKey('0000320193-25-000123:7')).toEqual({
      accessionNo: '0000320193-25-000123',
      sectionCode: '7',
    })
  })

  it('handles 10-Q part-style codes', () => {
    expect(parseSectionSubKey('0000320193-25-000456:part1item2')).toEqual({
      accessionNo: '0000320193-25-000456',
      sectionCode: 'part1item2',
    })
  })

  it('handles 8-K codes containing dashes', () => {
    expect(parseSectionSubKey('0000320193-25-000789:5-2')).toEqual({
      accessionNo: '0000320193-25-000789',
      sectionCode: '5-2',
    })
  })

  it('returns null for missing sub_key', () => {
    expect(parseSectionSubKey(null)).toBeNull()
    expect(parseSectionSubKey('')).toBeNull()
  })

  it('returns null when colon is missing', () => {
    expect(parseSectionSubKey('0000320193-25-000123')).toBeNull()
  })

  it('returns null when either side of the colon is empty', () => {
    expect(parseSectionSubKey(':7')).toBeNull()
    expect(parseSectionSubKey('0000320193-25-000123:')).toBeNull()
  })
})

describe('deriveSectionStatus', () => {
  // The pre-refactor storage conflated 'error' and 'empty' as "missing key".
  // These cases lock in the three-state distinction that gives operators
  // visibility into why a section is absent.

  it("returns 'error' when upstream fetch failed regardless of body", () => {
    expect(deriveSectionStatus('error', null)).toBe('error')
    expect(deriveSectionStatus('error', '')).toBe('error')
    expect(deriveSectionStatus('error', 'partial body')).toBe('error')
  })

  it("returns 'empty' when fetch succeeded but no text returned", () => {
    expect(deriveSectionStatus('complete', null)).toBe('empty')
    expect(deriveSectionStatus('complete', '')).toBe('empty')
  })

  it("returns 'success' when fetch succeeded with non-empty text", () => {
    expect(deriveSectionStatus('complete', 'MD&A discussion text')).toBe('success')
  })

  it('treats unknown upstream statuses as non-error', () => {
    // Defensive — if upstream introduces a new status, we still classify
    // by body presence rather than collapsing to error.
    expect(deriveSectionStatus('processing', 'text')).toBe('success')
    expect(deriveSectionStatus('processing', '')).toBe('empty')
  })

  it("treats whitespace-only bodies as 'empty'", () => {
    // sec-api occasionally returns "\n  \n" for items not present in a
    // filing. Without trimming, those used to land as 10-char "successful"
    // sections that confused the skip-policy.
    expect(deriveSectionStatus('complete', '   ')).toBe('empty')
    expect(deriveSectionStatus('complete', '\n\n  \t')).toBe('empty')
  })

  it("flips the 'processing' placeholder to 'error' as defence in depth", () => {
    // Real bug found 2026-04-29: sec-api.io's section extractor returns the
    // literal string "processing" while still extracting; SecApiClient
    // polls past it, but if a future code path bypasses the client we still
    // refuse to land it as a "successful 10-char section".
    expect(deriveSectionStatus('complete', 'processing')).toBe('error')
    expect(deriveSectionStatus('complete', 'Processing')).toBe('error')
    expect(deriveSectionStatus('complete', '  processing\n')).toBe('error')
  })
})
