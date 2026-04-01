import { describe, expect, it } from 'vitest'
import { getCanonicalFirstName } from './nickname-map'

describe('getCanonicalFirstName', () => {
  it('resolves common nicknames to formal names', () => {
    expect(getCanonicalFirstName('Tim')).toBe('timothy')
    expect(getCanonicalFirstName('Bob')).toBe('robert')
    expect(getCanonicalFirstName('Larry')).toBe('lawrence')
    expect(getCanonicalFirstName('Bill')).toBe('william')
    expect(getCanonicalFirstName('Jim')).toBe('james')
    expect(getCanonicalFirstName('Mike')).toBe('michael')
    expect(getCanonicalFirstName('Steve')).toBe('steven')
    expect(getCanonicalFirstName('Jeff')).toBe('jeffrey')
    expect(getCanonicalFirstName('Dick')).toBe('richard')
    expect(getCanonicalFirstName('Rick')).toBe('richard')
  })

  it('is case insensitive', () => {
    expect(getCanonicalFirstName('TIM')).toBe('timothy')
    expect(getCanonicalFirstName('tim')).toBe('timothy')
    expect(getCanonicalFirstName('Tim')).toBe('timothy')
  })

  it('returns already-formal names lowercased', () => {
    expect(getCanonicalFirstName('Timothy')).toBe('timothy')
    expect(getCanonicalFirstName('Robert')).toBe('robert')
    expect(getCanonicalFirstName('Lawrence')).toBe('lawrence')
  })

  it('returns unknown names lowercased', () => {
    expect(getCanonicalFirstName('Satya')).toBe('satya')
    expect(getCanonicalFirstName('Sundar')).toBe('sundar')
    expect(getCanonicalFirstName('Elon')).toBe('elon')
  })

  it('handles multiple nicknames mapping to the same formal name', () => {
    // Both Bob and Rob map to Robert
    expect(getCanonicalFirstName('Bob')).toBe('robert')
    expect(getCanonicalFirstName('Rob')).toBe('robert')

    // Both Bill and Will map to William
    expect(getCanonicalFirstName('Bill')).toBe('william')
    expect(getCanonicalFirstName('Will')).toBe('william')

    // Both Liz and Beth map to Elizabeth
    expect(getCanonicalFirstName('Liz')).toBe('elizabeth')
    expect(getCanonicalFirstName('Beth')).toBe('elizabeth')
  })
})
