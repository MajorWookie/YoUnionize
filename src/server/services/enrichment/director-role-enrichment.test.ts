import { describe, expect, it } from 'vitest'
import { classifyRole } from './director-role-enrichment'

function makeRow(overrides: Partial<{
  title: string
  isIndependent: boolean | null
  directorClass: string | null
  committees: Array<string> | null
}>) {
  return {
    id: 'test-id',
    title: overrides.title ?? 'Director',
    isIndependent: overrides.isIndependent ?? null,
    directorClass: overrides.directorClass ?? null,
    committees: overrides.committees ?? null,
  }
}

describe('classifyRole', () => {
  // ─── Rule 1: isIndependent signal ──────────────────────────────────

  it('classifies as director when isIndependent is true', () => {
    expect(classifyRole(makeRow({ isIndependent: true }))).toBe('director')
  })

  it('classifies as director when isIndependent is false (non-independent board member)', () => {
    expect(classifyRole(makeRow({ isIndependent: false }))).toBe('director')
  })

  // ─── Rule 2: directorClass signal ──────────────────────────────────

  it('classifies as director when directorClass is set', () => {
    expect(classifyRole(makeRow({ directorClass: 'II' }))).toBe('director')
  })

  // ─── Rule 3: Officer + director signals → both ────────────────────

  it('classifies as both when CEO has isIndependent signal', () => {
    expect(classifyRole(makeRow({
      title: 'Chief Executive Officer',
      isIndependent: false,
    }))).toBe('both')
  })

  it('classifies as both when CEO has committee memberships', () => {
    expect(classifyRole(makeRow({
      title: 'CEO',
      committees: ['Nominating'],
    }))).toBe('both')
  })

  it('classifies as both when CEO has directorClass', () => {
    expect(classifyRole(makeRow({
      title: 'Chief Executive Officer',
      directorClass: 'I',
    }))).toBe('both')
  })

  // ─── Rule 4: Pure officer ─────────────────────────────────────────

  it('classifies as officer when CFO with no director signals', () => {
    expect(classifyRole(makeRow({
      title: 'Senior Vice President, Chief Financial Officer',
      committees: [],
    }))).toBe('officer')
  })

  it('classifies as officer for COO with no board signals', () => {
    expect(classifyRole(makeRow({
      title: 'Chief Operating Officer',
    }))).toBe('officer')
  })

  it('classifies as officer for General Counsel', () => {
    expect(classifyRole(makeRow({
      title: 'Senior Vice President, General Counsel',
    }))).toBe('officer')
  })

  it('classifies as officer for SVP Retail', () => {
    expect(classifyRole(makeRow({
      title: 'Senior Vice President, Retail',
    }))).toBe('officer')
  })

  it('classifies as officer for CIO', () => {
    expect(classifyRole(makeRow({
      title: 'Chief Information Officer',
    }))).toBe('officer')
  })

  // ─── Rule 5: Executive Chairman ───────────────────────────────────

  it('classifies as both for Executive Chairman of the Board', () => {
    expect(classifyRole(makeRow({
      title: 'Executive Chairman of the Board',
    }))).toBe('both')
  })

  it('classifies as both for Executive Chairman', () => {
    expect(classifyRole(makeRow({
      title: 'Executive Chairman',
    }))).toBe('both')
  })

  // ─── Rule 6: Director/Chair without officer keywords ──────────────

  it('classifies as director for "Director"', () => {
    expect(classifyRole(makeRow({ title: 'Director' }))).toBe('director')
  })

  it('classifies as director for Lead Independent Director', () => {
    expect(classifyRole(makeRow({
      title: 'Lead Independent Director',
      isIndependent: true,
    }))).toBe('director')
  })

  it('classifies as director for "Chair" without officer keywords', () => {
    expect(classifyRole(makeRow({ title: 'Chair of the Audit Committee' }))).toBe('director')
  })

  it('classifies as director when title has Director with committee', () => {
    expect(classifyRole(makeRow({
      title: 'Director',
      committees: ['Audit'],
    }))).toBe('director')
  })

  // ─── Rule 7: Ambiguous ───────────────────────────────────────────

  it('returns null for unrecognized title with no signals', () => {
    expect(classifyRole(makeRow({
      title: 'Member of Advisory Council',
    }))).toBeNull()
  })

  // ─── Edge cases ───────────────────────────────────────────────────

  it('classifies as director when title is unusual but has director signals', () => {
    expect(classifyRole(makeRow({
      title: 'Board Observer',
      committees: ['Compensation'],
    }))).toBe('director')
  })

  it('classifies division president as officer', () => {
    expect(classifyRole(makeRow({
      title: 'President, IHOP Division',
    }))).toBe('officer')
  })

  it('classifies President and CEO with board signals as both', () => {
    expect(classifyRole(makeRow({
      title: 'President and Chief Executive Officer',
      isIndependent: false,
    }))).toBe('both')
  })
})
