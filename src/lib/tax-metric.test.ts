import { describe, expect, it } from 'vitest'
import { resolveTaxes, type RevenueRef } from './tax-metric'
import type { FinancialLineItem, FinancialStatement } from './financial-types'

function item(
  label: string,
  current: number | null,
  prior: number | null = null,
  changePercent: number | null = null,
): FinancialLineItem {
  return { label, current, prior, change: null, changePercent }
}

function incomeStmt(items: Array<FinancialLineItem>): FinancialStatement {
  return {
    title: 'Income Statement',
    periodCurrent: '2024-12-31',
    periodPrior: '2023-12-31',
    items,
  }
}

function cashFlow(items: Array<FinancialLineItem>): FinancialStatement {
  return {
    title: 'Cash Flow Statement',
    periodCurrent: '2024-12-31',
    periodPrior: '2023-12-31',
    items,
  }
}

const revenue50B: RevenueRef = { value: 50_000_000_000, period: '2024-12-31' }
const revenue2B: RevenueRef = { value: 2_000_000_000, period: '2024-12-31' }

describe('resolveTaxes — strategy 1 (income_statement)', () => {
  it('renders profitable filer with % of revenue and % of profit hints', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Revenue', 50_000_000_000),
        item('Income Tax Expense', 5_000_000_000),
        item('Income before taxes', 20_000_000_000),
        item('Net income', 15_000_000_000),
      ]),
    }
    const result = resolveTaxes(summary, revenue50B)
    expect(result.label).toBe('Taxes')
    expect(result.displayValue).toBe('$5B')
    expect(result.hint).toBe('33.3% of profit · 10.0% of revenue')
    expect(result.source).toBe('income_statement')
  })

  it('renders loss-year filer with negative tax line as Tax benefit', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income Tax Expense', -300_000_000),
        item('Income before taxes', -1_000_000_000),
        item('Net loss', -700_000_000),
      ]),
    }
    const result = resolveTaxes(summary, revenue2B)
    expect(result.label).toBe('Tax benefit')
    expect(result.displayValue).toBe('$300M')
    // Net loss ≤ 0 → profit ratio is omitted; only revenue ratio shows.
    expect(result.hint).toBe('15.0% benefit on revenue')
    expect(result.source).toBe('income_statement')
  })

  it('handles parenthesized "(Benefit) Provision for Income Taxes"', () => {
    const summary = {
      income_statement: incomeStmt([
        item('(Benefit) Provision for Income Taxes', -100_000_000),
      ]),
    }
    const result = resolveTaxes(summary, revenue2B)
    expect(result.label).toBe('Tax benefit')
    expect(result.displayValue).toBe('$100M')
    expect(result.source).toBe('income_statement')
  })

  it('rejects "Deferred income taxes" sub-line and falls through', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Deferred income taxes', 80_000_000),
      ]),
    }
    const result = resolveTaxes(summary, revenue2B)
    expect(result.source).toBe('fallback')
    expect(result.displayValue).toBe('—')
  })

  it('matches financial-services-style "Income tax expense" line', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Interest income', 80_000_000_000),
        item('Interest expense', 30_000_000_000),
        item('Income tax expense', 11_000_000_000),
        item('Income before taxes', 50_000_000_000),
      ]),
    }
    const result = resolveTaxes(summary, { value: 158_000_000_000, period: '2024-12-31' })
    expect(result.source).toBe('income_statement')
    expect(result.label).toBe('Taxes')
    expect(result.displayValue).toBe('$11B')
  })
})

describe('resolveTaxes — strategy 2 (cash_flow)', () => {
  it('falls back to cash flow taxes-paid line', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Revenue', 5_000_000_000),
      ]),
      cash_flow: cashFlow([
        item('Cash from operations', 1_500_000_000),
        item('Income taxes paid', 1_200_000_000),
      ]),
    }
    const result = resolveTaxes(summary, { value: 5_000_000_000, period: '2024-12-31' })
    expect(result.source).toBe('cash_flow')
    expect(result.displayValue).toBe('$1.2B')
    expect(result.hint).toContain('cash paid')
  })

  it('matches "Cash paid for income taxes" variant', () => {
    const summary = {
      cash_flow: cashFlow([
        item('Cash paid for income taxes', 800_000_000),
      ]),
    }
    const result = resolveTaxes(summary, null)
    expect(result.source).toBe('cash_flow')
    expect(result.displayValue).toBe('$800M')
  })
})

describe('resolveTaxes — strategy 3 (derived from pre-tax − net-income)', () => {
  it('derives taxes for a profitable filer with no canonical tax line', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income before taxes', 1_000_000_000),
        item('Net income', 750_000_000),
      ]),
    }
    const result = resolveTaxes(summary, null)
    expect(result.source).toBe('derived')
    expect(result.label).toBe('Taxes')
    expect(result.displayValue).toBe('$250M')
    // Profit ratio takes precedence over the effective-rate fallback.
    expect(result.hint).toBe('33.3% of profit')
  })

  it('derives a tax benefit for a loss-year filer', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income before taxes', -100_000_000),
        item('Net loss', -80_000_000),
      ]),
    }
    const result = resolveTaxes(summary, null)
    expect(result.source).toBe('derived')
    expect(result.label).toBe('Tax benefit')
    expect(result.displayValue).toBe('$20M')
  })
})

describe('resolveTaxes — strategy 4 (prior year)', () => {
  it('falls back to the prior-year value when current is null', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income Tax Expense', null, 2_100_000_000),
      ]),
    }
    const result = resolveTaxes(summary, null)
    expect(result.source).toBe('prior_year')
    expect(result.displayValue).toBe('$2.1B')
    expect(result.hint).toContain('Prior year')
  })
})

describe('resolveTaxes — strategy 5 (fallback)', () => {
  it('renders an em-dash and explanatory hint for empty summary', () => {
    const result = resolveTaxes({}, null)
    expect(result.source).toBe('fallback')
    expect(result.displayValue).toBe('—')
    expect(result.label).toBe('Taxes')
    expect(result.hint).toBe('Tax detail not in this filing')
  })

  it('renders fallback when income_statement has no relevant lines', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Revenue', 1_000_000_000),
        item('Operating income', 200_000_000),
      ]),
    }
    const result = resolveTaxes(summary, null)
    expect(result.source).toBe('fallback')
  })
})

describe('resolveTaxes — profit ratio in hint', () => {
  it('shows profit ratio alongside revenue ratio when both are present', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income Tax Expense', 1_700_000_000),
        item('Net income', 12_400_000_000),
      ]),
    }
    const result = resolveTaxes(summary, { value: 57_400_000_000, period: '2025-05-31' })
    expect(result.hint).toBe('13.7% of profit · 3.0% of revenue')
  })

  it('shows only profit ratio when revenue is missing', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income Tax Expense', 500_000_000),
        item('Net income', 2_000_000_000),
      ]),
    }
    const result = resolveTaxes(summary, null)
    expect(result.hint).toBe('25.0% of profit')
  })

  it('skips profit ratio when net income is zero or negative', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Revenue', 1_000_000_000),
        item('Income Tax Expense', 50_000_000),
        item('Net loss', -100_000_000),
      ]),
    }
    const result = resolveTaxes(summary, { value: 1_000_000_000, period: '2024-12-31' })
    expect(result.hint).toBe('5.0% of revenue')
  })

  it('uses "benefit on profit" wording when value is negative', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income Tax Expense', -50_000_000),
        item('Net income', 200_000_000),
      ]),
    }
    const result = resolveTaxes(summary, null)
    // Tax benefit of $50M against a $200M profit → 25% benefit on profit.
    expect(result.label).toBe('Tax benefit')
    expect(result.hint).toBe('25.0% benefit on profit')
  })
})

describe('resolveTaxes — YoY delta', () => {
  it('passes through changePercent for income_statement strategy', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income Tax Expense', 5_000_000_000, 4_500_000_000, 11.1),
      ]),
    }
    const result = resolveTaxes(summary, null)
    expect(result.delta).toEqual({ value: '+11.1% YoY', direction: 'up' })
  })

  it('marks down direction for declining tax bills', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income Tax Expense', 3_000_000_000, 5_000_000_000, -40),
      ]),
    }
    const result = resolveTaxes(summary, null)
    expect(result.delta).toEqual({ value: '-40.0% YoY', direction: 'down' })
  })

  it('computes YoY delta for derived strategy from prior pre-tax/net-income', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income before taxes', 1_000_000_000, 800_000_000),
        item('Net income', 750_000_000, 600_000_000),
      ]),
    }
    const result = resolveTaxes(summary, null)
    // current derived = 250M, prior derived = 200M, change = +25%
    expect(result.source).toBe('derived')
    expect(result.delta).toEqual({ value: '+25.0% YoY', direction: 'up' })
  })

  it('omits delta when only one period is available', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income Tax Expense', 1_000_000_000, null, null),
      ]),
    }
    const result = resolveTaxes(summary, null)
    expect(result.delta).toBeUndefined()
  })

  it('omits delta for fallback', () => {
    const result = resolveTaxes({}, null)
    expect(result.delta).toBeUndefined()
  })
})

describe('resolveTaxes — edge cases', () => {
  it('handles zero pre-tax without divide-by-zero', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income before taxes', 0),
        item('Income Tax Expense', 1_000_000),
      ]),
    }
    const result = resolveTaxes(summary, null)
    expect(result.source).toBe('income_statement')
    expect(result.displayValue).toBe('$1M')
    expect(result.hint).toBe('2024-12-31')
  })

  it('handles zero revenue without divide-by-zero', () => {
    const summary = {
      income_statement: incomeStmt([
        item('Income Tax Expense', 1_000_000),
        item('Income before taxes', 5_000_000),
      ]),
    }
    const result = resolveTaxes(summary, { value: 0, period: '2024-12-31' })
    expect(result.source).toBe('income_statement')
    expect(result.hint).toBe('20.0% effective')
  })

  it('survives a malformed summary object', () => {
    const result = resolveTaxes(
      { income_statement: 'not an object' as unknown },
      null,
    )
    expect(result.source).toBe('fallback')
  })
})
