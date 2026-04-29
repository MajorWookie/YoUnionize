import { describe, expect, it } from 'vitest'
import {
  Def14aSection,
  EightKSection,
  TenKSection,
  TenQSection,
} from '../sec-api.constants'
import {
  getActualSectionItems,
  getSectionFriendlyName,
  getSectionItemsForFilingType,
  legacyKeyToSectionCode,
  sectionCodeToLegacyKey,
} from '../sections'

describe('getSectionItemsForFilingType', () => {
  it('returns all 21 sections for 10-K', () => {
    const items = getSectionItemsForFilingType('10-K')
    expect(items).toHaveLength(Object.keys(TenKSection).length)
    const codes = items.map((i) => i.code)
    expect(codes).toContain(TenKSection.MD_AND_A)
    expect(codes).toContain(TenKSection.RISK_FACTORS)
    expect(codes).toContain(TenKSection.CYBERSECURITY)
  })

  it('returns all 11 sections for 10-Q', () => {
    const items = getSectionItemsForFilingType('10-Q')
    expect(items).toHaveLength(Object.keys(TenQSection).length)
    expect(items.map((i) => i.code)).toContain(TenQSection.MD_AND_A)
  })

  it('returns all sections for 8-K', () => {
    const items = getSectionItemsForFilingType('8-K')
    expect(items).toHaveLength(Object.keys(EightKSection).length)
    expect(items.map((i) => i.code)).toContain(EightKSection.DIRECTOR_OFFICER_CHANGES)
  })

  it('returns DEF 14A sections including proxy and exec compensation', () => {
    const items = getSectionItemsForFilingType('DEF 14A')
    expect(items.map((i) => i.code).sort()).toEqual(
      [Def14aSection.PROXY, Def14aSection.EXECUTIVE_COMPENSATION].sort(),
    )
  })

  it('returns empty array for unknown filing types', () => {
    expect(getSectionItemsForFilingType('S-1')).toEqual([])
    expect(getSectionItemsForFilingType('')).toEqual([])
  })

  it('attaches the enum key as the section name', () => {
    const items = getSectionItemsForFilingType('10-K')
    const mdItem = items.find((i) => i.code === TenKSection.MD_AND_A)
    expect(mdItem?.name).toBe('MD_AND_A')
  })
})

describe('legacyKeyToSectionCode', () => {
  // The same camelCase legacy key maps to different SEC codes per filing type.
  // This is the bug class the refactor closes — a global key→code map would
  // be wrong because MD&A is item '7' on 10-K but 'part1item2' on 10-Q.
  it('resolves mdAndA to 10-K item 7', () => {
    expect(legacyKeyToSectionCode('mdAndA', '10-K')).toBe(TenKSection.MD_AND_A)
  })

  it('resolves mdAndA to 10-Q part1item2', () => {
    expect(legacyKeyToSectionCode('mdAndA', '10-Q')).toBe(TenQSection.MD_AND_A)
  })

  it('resolves riskFactors per filing type', () => {
    expect(legacyKeyToSectionCode('riskFactors', '10-K')).toBe(TenKSection.RISK_FACTORS)
    expect(legacyKeyToSectionCode('riskFactors', '10-Q')).toBe(TenQSection.RISK_FACTORS)
  })

  it('resolves DEF 14A proxy and exec compensation', () => {
    expect(legacyKeyToSectionCode('proxy', 'DEF 14A')).toBe(Def14aSection.PROXY)
    expect(legacyKeyToSectionCode('executiveCompensation', 'DEF 14A')).toBe(
      Def14aSection.EXECUTIVE_COMPENSATION,
    )
  })

  it('resolves executiveCompensation differently for 10-K vs DEF 14A', () => {
    expect(legacyKeyToSectionCode('executiveCompensation', '10-K')).toBe(
      TenKSection.EXECUTIVE_COMPENSATION,
    )
    expect(legacyKeyToSectionCode('executiveCompensation', 'DEF 14A')).toBe(
      Def14aSection.EXECUTIVE_COMPENSATION,
    )
  })

  it('returns null for unknown key', () => {
    expect(legacyKeyToSectionCode('madeUp', '10-K')).toBeNull()
  })

  it('returns null when key exists but not for that filing type', () => {
    expect(legacyKeyToSectionCode('proxy', '10-K')).toBeNull()
    expect(legacyKeyToSectionCode('businessOverview', '10-Q')).toBeNull()
  })
})

describe('sectionCodeToLegacyKey', () => {
  it('round-trips with legacyKeyToSectionCode for known mappings', () => {
    const cases: Array<[string, string]> = [
      ['mdAndA', '10-K'],
      ['mdAndA', '10-Q'],
      ['riskFactors', '10-K'],
      ['riskFactors', '10-Q'],
      ['businessOverview', '10-K'],
      ['proxy', 'DEF 14A'],
      ['executiveCompensation', '10-K'],
      ['executiveCompensation', 'DEF 14A'],
    ]
    for (const [key, filingType] of cases) {
      const code = legacyKeyToSectionCode(key, filingType)
      expect(code, `forward: ${key}/${filingType}`).not.toBeNull()
      const back = sectionCodeToLegacyKey(code!, filingType)
      expect(back, `reverse: ${code}/${filingType}`).toBe(key)
    }
  })

  it('returns null for codes without legacy counterparts (e.g. 8-K items)', () => {
    expect(sectionCodeToLegacyKey(EightKSection.DIRECTOR_OFFICER_CHANGES, '8-K')).toBeNull()
    expect(sectionCodeToLegacyKey(TenKSection.CYBERSECURITY, '10-K')).toBeNull()
  })
})

describe('getSectionFriendlyName', () => {
  it('returns the enum key for known codes', () => {
    expect(getSectionFriendlyName(TenKSection.MD_AND_A, '10-K')).toBe('MD_AND_A')
    expect(getSectionFriendlyName(EightKSection.DIRECTOR_OFFICER_CHANGES, '8-K')).toBe(
      'DIRECTOR_OFFICER_CHANGES',
    )
    expect(getSectionFriendlyName(Def14aSection.PROXY, 'DEF 14A')).toBe('PROXY')
  })

  it('falls back to the raw code when unknown', () => {
    expect(getSectionFriendlyName('made-up', '10-K')).toBe('made-up')
    expect(getSectionFriendlyName('1A', 'S-1')).toBe('1A')
  })
})

describe('getActualSectionItems', () => {
  // Real performance bug 2026-04-29: asking sec-api to extract every
  // possible 8-K item burned 60s+ per non-existent item. Filtering to the
  // items actually in the filing eliminates that dead time.

  it('parses real-world 8-K item strings into SEC codes', () => {
    const items = getActualSectionItems('8-K', [
      'Item 5.02: Departure of Directors or Certain Officers',
      'Item 7.01: Regulation FD Disclosure',
      'Item 9.01: Financial Statements and Exhibits',
    ])
    const codes = items.map((i) => i.code).sort()
    // 5-2, 7-1, 9-1 plus signature (always included for 8-K)
    expect(codes).toEqual(['5-2', '7-1', '9-1', 'signature'])
  })

  it('strips leading zeros from minor numbers (5.02 → 5-2, not 5-02)', () => {
    const items = getActualSectionItems('8-K', ['Item 1.01: Material agreement'])
    expect(items.map((i) => i.code)).toContain(EightKSection.ENTRY_AGREEMENT)
  })

  it('always includes signature for 8-K even if not in the items list', () => {
    const items = getActualSectionItems('8-K', ['Item 5.02: Officer changes'])
    expect(items.map((i) => i.code)).toContain(EightKSection.SIGNATURE)
  })

  it('falls through to the full list when items is missing or empty', () => {
    expect(getActualSectionItems('8-K', undefined)).toHaveLength(
      Object.keys(EightKSection).length,
    )
    expect(getActualSectionItems('8-K', [])).toHaveLength(
      Object.keys(EightKSection).length,
    )
  })

  it('is a no-op for 10-K, 10-Q, DEF 14A — those forms have predictable items', () => {
    // Even with rawItems supplied, non-8-K filings get the full list (every
    // 10-K has all 21 item headings as part of the form structure).
    expect(getActualSectionItems('10-K', ['Item 1A'])).toHaveLength(
      Object.keys(TenKSection).length,
    )
    expect(getActualSectionItems('10-Q', ['Item 2'])).toHaveLength(
      Object.keys(TenQSection).length,
    )
    expect(getActualSectionItems('DEF 14A', ['Item 7'])).toHaveLength(
      Object.keys(Def14aSection).length,
    )
  })

  it('skips malformed item strings without throwing', () => {
    const items = getActualSectionItems('8-K', [
      'Item 5.02: Officer changes',
      'something that is not an item line',
      '',
    ])
    expect(items.map((i) => i.code).sort()).toEqual(['5-2', 'signature'])
  })
})
