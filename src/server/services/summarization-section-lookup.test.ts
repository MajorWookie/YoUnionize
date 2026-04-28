import { describe, expect, it } from 'vitest'
import {
  getPipelineSectionText,
  PIPELINE_SECTION_TO_CODE,
  type SectionMap,
} from './summarization-section-lookup'

function makeMap(entries: Record<string, string>): SectionMap {
  return new Map(Object.entries(entries))
}

describe('getPipelineSectionText', () => {
  it('reads MD&A from the correct code per filing type', () => {
    // The same pipeline name (`mda`) resolves to different SEC codes
    // depending on form. This is the bug class the new lookup table closes.
    const tenK = makeMap({ '7': 'TenK MD&A text' })
    expect(getPipelineSectionText(tenK, 'mda', '10-K')).toBe('TenK MD&A text')

    const tenQ = makeMap({ part1item2: 'TenQ MD&A text' })
    expect(getPipelineSectionText(tenQ, 'mda', '10-Q')).toBe('TenQ MD&A text')
  })

  it('reads risk_factors from the correct code per filing type', () => {
    const tenK = makeMap({ '1A': 'risk text 10-K' })
    const tenQ = makeMap({ part2item1a: 'risk text 10-Q' })
    expect(getPipelineSectionText(tenK, 'risk_factors', '10-K')).toBe('risk text 10-K')
    expect(getPipelineSectionText(tenQ, 'risk_factors', '10-Q')).toBe('risk text 10-Q')
  })

  it('returns null when the pipeline section is unmapped for that filing type', () => {
    // 'business_overview' is a 10-K item; 10-Q has no mapping.
    const map = makeMap({ '1': 'biz overview text' })
    expect(getPipelineSectionText(map, 'business_overview', '10-Q')).toBeNull()
  })

  it('returns null when the code is mapped but the section row is missing', () => {
    const map = makeMap({ '7': 'mda text' })
    expect(getPipelineSectionText(map, 'risk_factors', '10-K')).toBeNull()
  })

  it('returns null for unknown filing types', () => {
    const map = makeMap({ '7': 'text' })
    expect(getPipelineSectionText(map, 'mda', 'S-1')).toBeNull()
    expect(getPipelineSectionText(map, 'mda', '')).toBeNull()
  })

  it('returns null for unknown pipeline section names', () => {
    const map = makeMap({ '7': 'text' })
    expect(getPipelineSectionText(map, 'made_up', '10-K')).toBeNull()
  })

  it('reads DEF 14A executive_compensation and proxy', () => {
    const map = makeMap({
      part1item7: 'exec comp narrative',
      part1item1: 'proxy narrative',
    })
    expect(getPipelineSectionText(map, 'executive_compensation', 'DEF 14A')).toBe(
      'exec comp narrative',
    )
    expect(getPipelineSectionText(map, 'proxy', 'DEF 14A')).toBe('proxy narrative')
  })

  it('reads 10-K executive_compensation from item 11 (rare; usually in DEF 14A)', () => {
    const map = makeMap({ '11': 'exec comp item 11' })
    expect(getPipelineSectionText(map, 'executive_compensation', '10-K')).toBe(
      'exec comp item 11',
    )
  })
})

describe('PIPELINE_SECTION_TO_CODE shape', () => {
  it('covers all filing types currently in FILING_SECTIONS', () => {
    expect(Object.keys(PIPELINE_SECTION_TO_CODE).sort()).toEqual(
      ['10-K', '10-Q', 'DEF 14A'].sort(),
    )
  })

  it('uses raw SEC codes (not enum keys) as values', () => {
    // Lock in that we store codes like '7', not 'MD_AND_A'. Consumers that
    // build SectionMap (loadFilingSections) key by section_code from the DB.
    expect(PIPELINE_SECTION_TO_CODE['10-K'].mda).toBe('7')
    expect(PIPELINE_SECTION_TO_CODE['10-Q'].mda).toBe('part1item2')
    expect(PIPELINE_SECTION_TO_CODE['DEF 14A'].proxy).toBe('part1item1')
  })
})
