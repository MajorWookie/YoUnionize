import { describe, it, expect } from 'vitest'
import { extractSunburstYears } from './income-data-extractor'
import type { FinancialStatement } from '../types'

function makeStatement(
  items: Array<{ label: string; current: number | null; prior?: number | null }>,
): FinancialStatement {
  return {
    title: 'Income Statement',
    periodCurrent: '2024-12-31',
    periodPrior: '2023-12-31',
    items: items.map((i) => ({
      label: i.label,
      current: i.current,
      prior: i.prior ?? null,
      change: null,
      changePercent: null,
    })),
  }
}

describe('extractSunburstYears', () => {
  it('produces sunburst data for REIT-labeled statements', () => {
    const statement = makeStatement([
      { label: 'Real Estate Revenue (Net)', current: 2_000_000_000 },
      { label: 'Rental Revenue', current: 1_600_000_000 },
      { label: 'Other Real Estate Revenue', current: 400_000_000 },
      { label: 'Direct Costs of Leased Property', current: 600_000_000 },
      { label: 'Depreciation & Amortization', current: 500_000_000 },
      { label: 'General & Administrative', current: 150_000_000 },
      { label: 'Interest Expense', current: 200_000_000 },
      { label: 'Income Tax Expense', current: 50_000_000 },
      { label: 'Net Income', current: 500_000_000 },
    ])

    const years = extractSunburstYears(statement, '2024-12-31')
    expect(years.length).toBeGreaterThan(0)
    expect(years[0].totalRevenue).toBe(2_000_000_000)
  })

  it('categorizes REIT revenue as total-revenue anchor', () => {
    const statement = makeStatement([
      { label: 'Real Estate Revenue (Net)', current: 1_000_000_000 },
      { label: 'Net Income', current: 200_000_000 },
    ])

    const years = extractSunburstYears(statement, '2024-12-31')
    expect(years.length).toBeGreaterThan(0)
    expect(years[0].totalRevenue).toBe(1_000_000_000)
    // Should have ring 2 at minimum (opex + operating income)
    expect(years[0].rings.length).toBeGreaterThanOrEqual(1)
  })

  it('places rental/lease revenue in revenue sub-items ring', () => {
    const statement = makeStatement([
      { label: 'Real Estate Revenue (Net)', current: 2_000_000_000 },
      { label: 'Rental Revenue', current: 1_600_000_000 },
      { label: 'Lease Revenue', current: 400_000_000 },
      { label: 'Net Income', current: 500_000_000 },
    ])

    const years = extractSunburstYears(statement, '2024-12-31')
    expect(years.length).toBeGreaterThan(0)

    // Ring 1 should contain revenue sub-items
    const ring1 = years[0].rings[0]
    expect(ring1.slices.length).toBe(2)
    const labels = ring1.slices.map((s) => s.label)
    expect(labels).toContain('Rental Revenue')
    expect(labels).toContain('Lease Revenue')
  })

  it('picks the largest revenue when multiple total-revenue items exist', () => {
    // Simulates Lamar: small "Revenue" sub-segment + larger "Real Estate Revenue (Net)" aggregate
    const statement = makeStatement([
      { label: 'Revenue', current: 163_000_000 },
      { label: 'Real Estate Revenue (Net)', current: 2_000_000_000 },
      { label: 'Cost of Goods Sold', current: 696_000_000 },
      { label: 'General & Administrative', current: 344_000_000 },
      { label: 'Net Income', current: 500_000_000 },
    ])

    const years = extractSunburstYears(statement, '2024-12-31')
    expect(years.length).toBeGreaterThan(0)
    // Must pick the $2B aggregate, not the $163M sub-item
    expect(years[0].totalRevenue).toBe(2_000_000_000)
  })

  it('still works for standard corporate statements', () => {
    const statement = makeStatement([
      { label: 'Revenue', current: 10_000_000_000, prior: 9_000_000_000 },
      { label: 'Cost of Revenue', current: 6_000_000_000, prior: 5_500_000_000 },
      { label: 'Gross Profit', current: 4_000_000_000, prior: 3_500_000_000 },
      { label: 'Operating Income', current: 2_500_000_000, prior: 2_000_000_000 },
      { label: 'Interest Expense', current: 200_000_000, prior: 180_000_000 },
      { label: 'Income Tax Expense', current: 500_000_000, prior: 400_000_000 },
      { label: 'Net Income', current: 1_800_000_000, prior: 1_420_000_000 },
    ])

    const years = extractSunburstYears(statement, '2024-12-31')
    expect(years.length).toBe(2) // current + prior
    expect(years[0].totalRevenue).toBe(10_000_000_000)
    expect(years[0].rings.length).toBeGreaterThanOrEqual(2) // ring 2 + ring 3
  })

  it('uses pre-tax income as fallback when no operating income exists', () => {
    const statement = makeStatement([
      { label: 'Revenue', current: 8_000_000_000 },
      { label: 'Cost of Revenue', current: 2_500_000_000 },
      { label: 'Income Before Taxes', current: 2_200_000_000 },
      { label: 'Interest Expense', current: 300_000_000 },
      { label: 'Income Tax Expense', current: 400_000_000 },
      { label: 'Net Income', current: 1_500_000_000 },
    ])

    const years = extractSunburstYears(statement, '2024-12-31')
    expect(years.length).toBeGreaterThan(0)
    expect(years[0].totalRevenue).toBe(8_000_000_000)

    // Ring 2 should label the income slice as "Income Before Taxes"
    const ring2 = years[0].rings.find((r) => !r.constrainedToSliceId)
    const incomeSlice = ring2?.slices.find((s) => s.id === 'operating-income')
    expect(incomeSlice?.label).toBe('Income Before Taxes')
  })

  it('does not double-count interest when anchor is pre-tax income', () => {
    // Pre-tax income = $600, Interest = $100, Tax = $100, Net Income = $400
    // With operating-income anchor: nonOp = 600 - 100 - 100 - 400 = 0
    // With pre-tax anchor: interest skipped, nonOp = 600 - 0 - 100 - 400 = 100
    const statement = makeStatement([
      { label: 'Revenue', current: 1_000_000_000 },
      { label: 'Income Before Taxes', current: 600_000_000 },
      { label: 'Interest Expense', current: 100_000_000 },
      { label: 'Income Tax Expense', current: 100_000_000 },
      { label: 'Net Income', current: 400_000_000 },
    ])

    const years = extractSunburstYears(statement, '2024-12-31')
    expect(years.length).toBeGreaterThan(0)

    // Ring 3 (constrained to operating-income) should NOT have interest expense slice
    const ring3 = years[0].rings.find((r) => r.constrainedToSliceId === 'operating-income')
    expect(ring3).toBeDefined()
    const interestSlice = ring3?.slices.find((s) => s.id === 'interest-expense')
    expect(interestSlice).toBeUndefined()
  })

  it('prefers operating income over pre-tax income when both exist', () => {
    const statement = makeStatement([
      { label: 'Revenue', current: 5_000_000_000 },
      { label: 'Operating Income', current: 2_000_000_000 },
      { label: 'Income Before Taxes', current: 1_800_000_000 },
      { label: 'Interest Expense', current: 150_000_000 },
      { label: 'Income Tax Expense', current: 350_000_000 },
      { label: 'Net Income', current: 1_300_000_000 },
    ])

    const years = extractSunburstYears(statement, '2024-12-31')
    expect(years.length).toBeGreaterThan(0)

    // Ring 2 should use "Operating Income" label, not "Income Before Taxes"
    const ring2 = years[0].rings.find((r) => !r.constrainedToSliceId)
    const incomeSlice = ring2?.slices.find((s) => s.id === 'operating-income')
    expect(incomeSlice?.label).toBe('Operating Income')

    // Ring 3 SHOULD have interest expense (since anchor is operating income, not pre-tax)
    const ring3 = years[0].rings.find((r) => r.constrainedToSliceId === 'operating-income')
    expect(ring3).toBeDefined()
    const interestSlice = ring3?.slices.find((s) => s.id === 'interest-expense')
    expect(interestSlice).toBeDefined()
    expect(interestSlice?.value).toBe(150_000_000)
  })

  it('does not misclassify revenue items containing opex keywords', () => {
    const statement = makeStatement([
      { label: 'Revenue', current: 3_000_000_000 },
      { label: 'Software Development Revenue', current: 1_500_000_000 },
      { label: 'Market Research Revenue', current: 1_500_000_000 },
      { label: 'Operating Income', current: 1_000_000_000 },
      { label: 'Net Income', current: 800_000_000 },
    ])

    const years = extractSunburstYears(statement, '2024-12-31')
    expect(years.length).toBeGreaterThan(0)

    // Ring 1 should contain both items as revenue sub-items
    const ring1 = years[0].rings[0]
    const labels = ring1.slices.map((s) => s.label)
    expect(labels).toContain('Software Development Revenue')
    expect(labels).toContain('Market Research Revenue')
  })

  it('categorizes Cost of Services as cost-of-revenue', () => {
    const statement = makeStatement([
      { label: 'Revenue', current: 2_000_000_000 },
      { label: 'Cost of Services', current: 800_000_000 },
      { label: 'Operating Income', current: 500_000_000 },
      { label: 'Net Income', current: 400_000_000 },
    ])

    const years = extractSunburstYears(statement, '2024-12-31')
    expect(years.length).toBeGreaterThan(0)

    // Cost of Services should appear in the expense breakdown
    const ring2 = years[0].rings.find((r) => !r.constrainedToSliceId)
    const opexSlice = ring2?.slices.find((s) => s.id === 'opex')
    expect(opexSlice?.breakdown).toBeDefined()
    const cosLabels = opexSlice!.breakdown!.map((b) => b.label)
    expect(cosLabels).toContain('Cost of Services')
  })
})
