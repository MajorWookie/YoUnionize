import { describe, expect, it } from 'vitest'
import { formatDate, formatRelativeTime } from './format'

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-05-02T12:00:00Z').getTime()

  it("returns 'just now' for sub-minute deltas", () => {
    const t = new Date(NOW - 30_000).toISOString()
    expect(formatRelativeTime(t, NOW)).toBe('just now')
  })

  it("clamps future timestamps to 'just now'", () => {
    const t = new Date(NOW + 5_000).toISOString()
    expect(formatRelativeTime(t, NOW)).toBe('just now')
  })

  it('formats minute-scale deltas', () => {
    const t = new Date(NOW - 7 * 60_000).toISOString()
    expect(formatRelativeTime(t, NOW)).toBe('7m ago')
  })

  it('formats hour-scale deltas', () => {
    const t = new Date(NOW - 5 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(t, NOW)).toBe('5h ago')
  })

  it('formats day-scale deltas under two weeks', () => {
    const t = new Date(NOW - 3 * 24 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(t, NOW)).toBe('3d ago')
  })

  it('falls back to absolute date once past the two-week window', () => {
    const iso = new Date(NOW - 30 * 24 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(iso, NOW)).toBe(formatDate(iso))
  })

  it('returns dash for null / undefined input', () => {
    expect(formatRelativeTime(null, NOW)).toBe('–')
    expect(formatRelativeTime(undefined, NOW)).toBe('–')
  })

  it('echoes back unparseable input', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('not-a-date')
  })
})
