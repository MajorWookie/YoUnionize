import { describe, expect, it } from 'vitest'
import { getEightKItemDisplay } from './eight-k-items'

describe('getEightKItemDisplay', () => {
  it('formats well-known codes with a SEC-style chip label', () => {
    const officer = getEightKItemDisplay('5-2')
    expect(officer.label).toBe('Officer Change')
    expect(officer.chipLabel).toBe('Item 5.02 — Officer Change')
    expect(officer.color).toBe('terracotta')
    expect(officer.icon).toBeTypeOf('object')
  })

  it('zero-pads the minor digit on the chip label', () => {
    expect(getEightKItemDisplay('1-1').chipLabel).toBe(
      'Item 1.01 — New Material Agreement',
    )
    expect(getEightKItemDisplay('9-1').chipLabel).toBe(
      'Item 9.01 — Financial Exhibits',
    )
  })

  it('routes earnings-release events through a green badge', () => {
    expect(getEightKItemDisplay('2-2').color).toBe('green')
  })

  it('falls back to a generic display for unknown codes', () => {
    const unknown = getEightKItemDisplay('99-99')
    expect(unknown.chipLabel).toBe('Item 99.99')
    expect(unknown.label).toBe('Item 99.99')
    expect(unknown.color).toBe('slate')
  })

  it('echoes non-numeric codes back as-is', () => {
    const sig = getEightKItemDisplay('signature')
    expect(sig.chipLabel).toBe('signature')
    expect(sig.label).toBe('signature')
  })
})
