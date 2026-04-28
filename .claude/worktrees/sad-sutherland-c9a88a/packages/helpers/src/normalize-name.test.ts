import { describe, expect, it } from 'vitest'
import { normalizeName } from './normalize-name'

describe('normalizeName', () => {
  it('lowercases and trims', () => {
    expect(normalizeName('  Timothy Cook  ')).toBe('timothy cook')
  })

  it('handles ALL CAPS names', () => {
    expect(normalizeName('TIMOTHY COOK')).toBe('timothy cook')
  })

  it('strips middle initials with period', () => {
    expect(normalizeName('Timothy D. Cook')).toBe('timothy cook')
  })

  it('strips middle initials without period', () => {
    expect(normalizeName('Timothy D Cook')).toBe('timothy cook')
  })

  it('strips multiple middle initials', () => {
    expect(normalizeName('Mary J. K. Rowling')).toBe('mary rowling')
  })

  it('preserves first-position initials', () => {
    expect(normalizeName('D. Bruce Sewell')).toBe('d. bruce sewell')
  })

  it('preserves last-position single-letter tokens', () => {
    // Edge case: single-letter last name (unlikely but safe)
    expect(normalizeName('Malcolm X')).toBe('malcolm x')
  })

  it('handles ALL CAPS with middle initial', () => {
    expect(normalizeName('TIMOTHY D. COOK')).toBe('timothy cook')
  })

  it('strips suffixes', () => {
    expect(normalizeName('Kevin Reilly Jr.')).toBe('kevin reilly')
    expect(normalizeName('Kevin Reilly Jr')).toBe('kevin reilly')
    expect(normalizeName('Robert Smith Sr.')).toBe('robert smith')
    expect(normalizeName('John Doe III')).toBe('john doe')
    expect(normalizeName('William Gates, IV')).toBe('william gates')
  })

  it('strips professional suffixes', () => {
    expect(normalizeName('Jane Smith Esq.')).toBe('jane smith')
    expect(normalizeName('Mary Jones Ph.D.')).toBe('mary jones')
    expect(normalizeName('John Brown M.D.')).toBe('john brown')
    expect(normalizeName('Amy Lee CPA')).toBe('amy lee')
  })

  it('handles single-word names', () => {
    expect(normalizeName('Cher')).toBe('cher')
  })

  it('handles two-word names without stripping', () => {
    expect(normalizeName('Tim Cook')).toBe('tim cook')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeName('Timothy   D.   Cook')).toBe('timothy cook')
  })

  it('handles suffix + middle initial together', () => {
    expect(normalizeName('Kevin J. Reilly Jr.')).toBe('kevin reilly')
  })

  it('preserves multi-letter middle names', () => {
    expect(normalizeName('Mary Jane Watson')).toBe('mary jane watson')
  })
})
