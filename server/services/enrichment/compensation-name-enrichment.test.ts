import { describe, expect, it } from 'vitest'
import {
  extractLastName,
  extractPositionKeywords,
  positionsOverlap,
  pickCanonical,
  groupByPerson,
} from './compensation-name-enrichment'

describe('extractLastName', () => {
  it('extracts last token as lowercase', () => {
    expect(extractLastName('Timothy D. Cook')).toBe('cook')
    expect(extractLastName('Jeff Williams')).toBe('williams')
  })

  it('handles single-word names', () => {
    expect(extractLastName('Madonna')).toBe('madonna')
  })

  it('handles prefix initials', () => {
    expect(extractLastName('D. Bruce Sewell')).toBe('sewell')
  })

  it('strips Jr./Sr. suffixes', () => {
    expect(extractLastName('Kevin Reilly Jr.')).toBe('reilly')
    expect(extractLastName('John Smith Sr')).toBe('smith')
  })

  it('strips roman numeral suffixes', () => {
    expect(extractLastName('Henry Ford III')).toBe('ford')
    expect(extractLastName('Robert Jones II')).toBe('jones')
  })

  it('trims whitespace', () => {
    expect(extractLastName('  Tim Cook  ')).toBe('cook')
  })
})

describe('extractPositionKeywords', () => {
  it('extracts role group IDs from full titles', () => {
    const kw = extractPositionKeywords('Chief Executive Officer')
    expect(kw).toContain('ceo')
  })

  it('extracts abbreviation role group IDs', () => {
    const kw = extractPositionKeywords('CEO')
    expect(kw).toContain('ceo')
  })

  it('extracts multiple role groups from compound titles', () => {
    const kw = extractPositionKeywords('Senior Vice President, Chief Financial Officer')
    expect(kw).toContain('svp')
    expect(kw).toContain('cfo')
    expect(kw).toContain('president')
  })

  it('returns empty for non-officer titles', () => {
    expect(extractPositionKeywords('Independent Director')).toEqual([])
    expect(extractPositionKeywords('Lead Director')).toEqual([])
  })

  it('does NOT match "cto" inside "Director"', () => {
    expect(extractPositionKeywords('Director')).toEqual([])
  })
})

describe('positionsOverlap', () => {
  it('returns true when keywords overlap', () => {
    expect(positionsOverlap('CEO', 'Chief Executive Officer')).toBe(true)
  })

  it('returns false when keywords do not overlap', () => {
    expect(positionsOverlap('Chief Financial Officer', 'General Counsel')).toBe(false)
  })

  it('returns true when either position is empty', () => {
    expect(positionsOverlap('', 'CFO')).toBe(true)
    expect(positionsOverlap('CEO', '')).toBe(true)
  })

  it('returns true when neither has recognized keywords', () => {
    expect(positionsOverlap('Director', 'Board Member')).toBe(true)
  })
})

describe('pickCanonical', () => {
  it('picks the most frequent name', () => {
    expect(pickCanonical(['Tim Cook', 'Timothy Cook', 'Tim Cook', 'Tim Cook'])).toBe('Tim Cook')
  })

  it('picks shortest on tie', () => {
    expect(pickCanonical(['Timothy Cook', 'Tim Cook'])).toBe('Tim Cook')
  })

  it('handles single name', () => {
    expect(pickCanonical(['Kevan Parekh'])).toBe('Kevan Parekh')
  })
})

describe('groupByPerson', () => {
  it('merges name variants with same last name and overlapping positions', () => {
    const rows = [
      { id: '1', executiveName: 'Tim Cook', title: 'Chief Executive Officer' },
      { id: '2', executiveName: 'Timothy Cook', title: 'CEO' },
      { id: '3', executiveName: 'Timothy D. Cook', title: 'Chief Executive Officer' },
    ]

    const groups = groupByPerson(rows)
    // All three should be in one group under "Tim Cook" (most frequent or shortest)
    expect(groups.size).toBe(1)
    const [canonical, ids] = [...groups.entries()][0]!
    expect(canonical).toBe('Tim Cook')
    expect(ids).toHaveLength(3)
  })

  it('does NOT merge different people with the same last name but different positions', () => {
    const rows = [
      { id: '1', executiveName: 'John Smith', title: 'Chief Financial Officer' },
      { id: '2', executiveName: 'James Smith', title: 'General Counsel' },
    ]

    const groups = groupByPerson(rows)
    expect(groups.size).toBe(2)
  })

  it('keeps distinct people separate', () => {
    const rows = [
      { id: '1', executiveName: 'Tim Cook', title: 'CEO' },
      { id: '2', executiveName: 'Jeff Williams', title: 'COO' },
      { id: '3', executiveName: 'Kate Adams', title: 'General Counsel' },
      { id: '4', executiveName: 'Kevan Parekh', title: 'CFO' },
    ]

    const groups = groupByPerson(rows)
    expect(groups.size).toBe(4)
  })

  it('merges AAPL-style name variants correctly', () => {
    const rows = [
      { id: '1', executiveName: 'Tim Cook', title: 'CEO' },
      { id: '2', executiveName: 'Timothy Cook', title: 'Chief Executive Officer' },
      { id: '3', executiveName: 'Timothy D. Cook', title: 'CEO' },
      { id: '4', executiveName: 'Jeff Williams', title: 'COO' },
      { id: '5', executiveName: 'Jeffrey Williams', title: 'Chief Operating Officer' },
      { id: '6', executiveName: 'Eddy Cue', title: 'SVP' },
      { id: '7', executiveName: 'Eduardo Cue', title: 'Senior Vice President' },
      { id: '8', executiveName: 'Kate Adams', title: 'General Counsel' },
    ]

    const groups = groupByPerson(rows)
    expect(groups.size).toBe(4) // Cook, Williams, Cue, Adams

    const cookGroup = [...groups.entries()].find(([_, ids]) =>
      ids.includes('1'),
    )
    expect(cookGroup).toBeDefined()
    expect(cookGroup![1]).toHaveLength(3)

    const williamsGroup = [...groups.entries()].find(([_, ids]) =>
      ids.includes('4'),
    )
    expect(williamsGroup).toBeDefined()
    expect(williamsGroup![1]).toHaveLength(2)
  })
})
