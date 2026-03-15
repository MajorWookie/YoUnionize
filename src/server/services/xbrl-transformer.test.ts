import { describe, it, expect } from 'vitest'
import { transformXbrlToStatements } from './xbrl-transformer'
import { createXbrlData } from '~/test/factories'

describe('transformXbrlToStatements', () => {
  it('extracts income statement from XBRL data', () => {
    const result = transformXbrlToStatements(createXbrlData())

    expect(result.income_statement).toBeDefined()
    expect(result.income_statement.title).toBe('Income Statement')
    expect(result.income_statement.periodCurrent).toBe('2024-12-31')
    expect(result.income_statement.periodPrior).toBe('2023-12-31')

    const revenue = result.income_statement.items.find((i) => i.label === 'Revenue')
    expect(revenue).toBeDefined()
    expect(revenue!.current).toBe(10_500_000_000)
    expect(revenue!.prior).toBe(9_130_000_000)
  })

  it('extracts balance sheet', () => {
    const result = transformXbrlToStatements(createXbrlData())

    expect(result.balance_sheet).toBeDefined()
    const assets = result.balance_sheet.items.find((i) => i.label === 'Total Assets')
    expect(assets).toBeDefined()
    expect(assets!.current).toBe(50_000_000_000)
    expect(assets!.prior).toBe(45_000_000_000)
  })

  it('extracts cash flow statement', () => {
    const result = transformXbrlToStatements(createXbrlData())

    expect(result.cash_flow).toBeDefined()
    const ops = result.cash_flow.items.find((i) => i.label === 'Cash from Operations')
    expect(ops).toBeDefined()
    expect(ops!.current).toBe(3_500_000_000)
  })

  it('calculates change and changePercent correctly', () => {
    const result = transformXbrlToStatements(createXbrlData())

    const netIncome = result.income_statement.items.find((i) => i.label === 'Net Income')
    expect(netIncome).toBeDefined()
    expect(netIncome!.change).toBe(2_100_000_000 - 1_650_000_000)
    // (450M / 1.65B) * 100 = 27.27%
    expect(netIncome!.changePercent).toBeCloseTo(27.27, 1)
  })

  it('returns empty result for empty XBRL data', () => {
    const result = transformXbrlToStatements({})
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('handles us-gaap prefixed keys', () => {
    const data = {
      StatementsOfIncome: {
        'us-gaap:Revenues': {
          '2024-12-31': 1_000_000,
        },
      },
    }

    const result = transformXbrlToStatements(data)
    expect(result.income_statement).toBeDefined()
    expect(result.income_statement.items[0].label).toBe('Revenue')
    expect(result.income_statement.items[0].current).toBe(1_000_000)
  })

  it('handles string numeric values', () => {
    const data = {
      StatementsOfIncome: {
        Revenues: {
          '2024-12-31': '1,234,567',
          '2023-12-31': '1,000,000',
        },
      },
    }

    const result = transformXbrlToStatements(data)
    expect(result.income_statement.items[0].current).toBe(1_234_567)
    expect(result.income_statement.items[0].prior).toBe(1_000_000)
  })

  it('handles value objects with nested value key', () => {
    const data = {
      StatementsOfIncome: {
        Revenues: {
          '2024-12-31': { value: 5_000_000 },
        },
      },
    }

    const result = transformXbrlToStatements(data)
    expect(result.income_statement.items[0].current).toBe(5_000_000)
  })

  it('returns null change when prior is zero', () => {
    const data = {
      StatementsOfIncome: {
        Revenues: {
          '2024-12-31': 1_000_000,
          '2023-12-31': 0,
        },
      },
    }

    const result = transformXbrlToStatements(data)
    const item = result.income_statement.items[0]
    expect(item.change).toBeNull()
    expect(item.changePercent).toBeNull()
  })

  it('finds statement data with Consolidated prefix', () => {
    const data = {
      ConsolidatedBalanceSheets: {
        Assets: {
          '2024-12-31': 100_000_000,
        },
      },
    }

    const result = transformXbrlToStatements(data)
    expect(result.balance_sheet).toBeDefined()
    expect(result.balance_sheet.items[0].label).toBe('Total Assets')
  })

  it('handles single-period data with null prior', () => {
    const data = {
      StatementsOfIncome: {
        Revenues: {
          '2024-12-31': 5_000_000,
        },
      },
    }

    const result = transformXbrlToStatements(data)
    const item = result.income_statement.items[0]
    expect(item.current).toBe(5_000_000)
    expect(item.prior).toBeNull()
    expect(item.change).toBeNull()
  })
})
