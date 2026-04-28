import { describe, it, expect } from 'vitest'
import {
  formatDollars,
  formatFinancial,
  formatPercent,
  formatShares,
  formatDate,
  getInitials,
} from './format'

describe('format utilities', () => {
  describe('formatDollars', () => {
    it('formats thousands with K suffix', () => {
      expect(formatDollars(8500)).toBe('$9K')
    })

    it('handles zero', () => {
      expect(formatDollars(0)).toBe('$0')
    })

    it('returns dash for null', () => {
      expect(formatDollars(null)).toBe('-')
    })

    it('formats large values with M suffix', () => {
      expect(formatDollars(25_000_000)).toBe('$25.0M')
    })

    it('formats billions', () => {
      expect(formatDollars(1_000_000_000)).toBe('$1.0B')
    })

    it('formats small values without suffix', () => {
      expect(formatDollars(500)).toBe('$500')
    })
  })

  describe('formatFinancial', () => {
    it('formats billions', () => {
      expect(formatFinancial(10500000000)).toBe('$10.5B')
    })

    it('formats millions', () => {
      expect(formatFinancial(45000000)).toBe('$45.0M')
    })

    it('formats thousands with K suffix', () => {
      expect(formatFinancial(500000)).toBe('$500K')
    })

    it('formats small values with 2 decimal places', () => {
      expect(formatFinancial(999)).toBe('$999.00')
    })

    it('returns dash for null', () => {
      expect(formatFinancial(null)).toBe('-')
    })

    it('handles negative values', () => {
      const result = formatFinancial(-5000000)
      expect(result).toBe('$-5.0M')
    })
  })

  describe('formatPercent', () => {
    it('formats positive percentage with + sign', () => {
      expect(formatPercent(27.27)).toBe('+27.3%')
    })

    it('formats negative percentage', () => {
      expect(formatPercent(-5.5)).toBe('-5.5%')
    })

    it('formats zero without sign', () => {
      expect(formatPercent(0)).toBe('0.0%')
    })

    it('returns dash for null', () => {
      expect(formatPercent(null)).toBe('-')
    })
  })

  describe('formatShares', () => {
    it('formats millions of shares', () => {
      expect(formatShares(1500000)).toBe('1.5M')
    })

    it('formats thousands of shares', () => {
      expect(formatShares(50000)).toBe('50K')
    })

    it('returns dash for null', () => {
      expect(formatShares(null)).toBe('-')
    })

    it('handles string input', () => {
      expect(formatShares('1500000')).toBe('1.5M')
    })

    it('returns dash for NaN string', () => {
      expect(formatShares('not a number')).toBe('-')
    })
  })

  describe('formatDate', () => {
    it('formats ISO date string', () => {
      const result = formatDate('2024-03-15T00:00:00.000Z')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('returns dash for null', () => {
      expect(formatDate(null)).toBe('-')
    })

    it('returns dash for empty string', () => {
      expect(formatDate('')).toBe('-')
    })
  })

  describe('getInitials', () => {
    it('returns initials from full name', () => {
      expect(getInitials('Jane Smith')).toBe('JS')
    })

    it('handles single name', () => {
      expect(getInitials('Alice')).toBe('A')
    })

    it('returns ? for empty string', () => {
      expect(getInitials('')).toBe('?')
    })

    it('handles three-part name', () => {
      expect(getInitials('Mary Jane Watson')).toBe('MW')
    })
  })
})
