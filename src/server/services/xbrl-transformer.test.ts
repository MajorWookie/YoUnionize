import { describe, it, expect } from 'vitest'
import { transformXbrlToStatements } from './xbrl-transformer'
import { createXbrlData, createReitXbrlData, createTechSaasXbrlData, createPharmaXbrlData } from '~/test/factories'

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

  it('extracts REIT income statement concepts', () => {
    const result = transformXbrlToStatements(createReitXbrlData())

    expect(result.income_statement).toBeDefined()
    expect(result.income_statement.periodCurrent).toBe('2024-12-31')

    const labels = result.income_statement.items.map((i) => i.label)
    expect(labels).toContain('Real Estate Revenue (Net)')
    expect(labels).toContain('Rental Revenue')
    expect(labels).toContain('Other Real Estate Revenue')
    expect(labels).toContain('Direct Costs of Leased Property')
    expect(labels).toContain('Depreciation & Amortization')
    expect(labels).toContain('General & Administrative')
    expect(labels).toContain('Net Income')

    const revenue = result.income_statement.items.find((i) => i.label === 'Real Estate Revenue (Net)')
    expect(revenue!.current).toBe(2_000_000_000)
    expect(revenue!.prior).toBe(1_850_000_000)
  })

  it('extracts DepreciationAndAmortization for any industry', () => {
    const data = {
      StatementsOfIncome: {
        Revenues: {
          '2024-12-31': 1_000_000,
        },
        DepreciationAndAmortization: {
          '2024-12-31': 200_000,
        },
      },
    }

    const result = transformXbrlToStatements(data)
    const da = result.income_statement.items.find((i) => i.label === 'Depreciation & Amortization')
    expect(da).toBeDefined()
    expect(da!.current).toBe(200_000)
  })

  it('extracts Tech/SaaS income statement concepts', () => {
    const result = transformXbrlToStatements(createTechSaasXbrlData())

    expect(result.income_statement).toBeDefined()

    const labels = result.income_statement.items.map((i) => i.label)
    expect(labels).toContain('Net Revenue')
    expect(labels).toContain('Subscription Revenue')
    expect(labels).toContain('Service Revenue')
    expect(labels).toContain('License Revenue')
    expect(labels).toContain('Stock-Based Compensation')
    expect(labels).toContain('Operating Income')

    const sbc = result.income_statement.items.find((i) => i.label === 'Stock-Based Compensation')
    expect(sbc!.current).toBe(300_000_000)
  })

  it('extracts pharma concepts including pre-tax income variant', () => {
    const result = transformXbrlToStatements(createPharmaXbrlData())

    expect(result.income_statement).toBeDefined()

    const labels = result.income_statement.items.map((i) => i.label)
    expect(labels).toContain('Revenue')
    expect(labels).toContain('Collaboration Revenue')
    expect(labels).toContain('License & Services Revenue')
    expect(labels).toContain('Restructuring Charges')
    expect(labels).toContain('Income Before Taxes')
    expect(labels).not.toContain('Operating Income')

    const preTax = result.income_statement.items.find((i) => i.label === 'Income Before Taxes')
    expect(preTax!.current).toBe(2_200_000_000)
  })

  it('extracts consolidated totals from array-format XBRL (skips segmented values)', () => {
    const data = {
      StatementsOfIncome: {
        // SEC API returns arrays when concepts have dimensional breakdowns
        RevenueFromContractWithCustomerIncludingAssessedTax: [
          // Consolidated total (no segment) — this should be picked
          { value: '2266214000', period: { endDate: '2025-12-31', startDate: '2025-01-01' }, unitRef: 'usd' },
          { value: '2207103000', period: { endDate: '2024-12-31', startDate: '2024-01-01' }, unitRef: 'usd' },
          // Billboard segment — should be skipped
          { value: '2013850000', period: { endDate: '2025-12-31', startDate: '2025-01-01' }, segment: { explicitMember: { $t: 'lamr:BillboardAdvertisingMember' } }, unitRef: 'usd' },
          // Transit segment — should be skipped (this was the $163M bug)
          { value: '163182000', period: { endDate: '2025-12-31', startDate: '2025-01-01' }, segment: { explicitMember: { $t: 'lamr:TransitAdvertisingMember' } }, unitRef: 'usd' },
        ],
        NetIncomeLoss: [
          { value: '-735400000', period: { endDate: '2025-12-31', startDate: '2025-01-01' }, unitRef: 'usd' },
          { value: '400000000', period: { endDate: '2024-12-31', startDate: '2024-01-01' }, unitRef: 'usd' },
        ],
      },
    }

    const result = transformXbrlToStatements(data)
    expect(result.income_statement).toBeDefined()

    const revenue = result.income_statement.items.find((i) => i.label === 'Net Revenue')
    expect(revenue).toBeDefined()
    // Must pick the $2.27B consolidated total, not the $163M transit segment
    expect(revenue!.current).toBe(2_266_214_000)
    expect(revenue!.prior).toBe(2_207_103_000)

    const netIncome = result.income_statement.items.find((i) => i.label === 'Net Income')
    expect(netIncome!.current).toBe(-735_400_000)
  })
})
