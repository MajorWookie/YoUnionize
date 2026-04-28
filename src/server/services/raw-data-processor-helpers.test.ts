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
})
