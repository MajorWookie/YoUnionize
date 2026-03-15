/**
 * Transforms raw XBRL JSON from SEC API into standardized financial statement formats
 * with period-over-period comparison. No Claude API calls — purely structural transformation.
 */

export interface FinancialLineItem {
  label: string
  current: number | null
  prior: number | null
  change: number | null
  changePercent: number | null
}

export interface FinancialStatement {
  title: string
  periodCurrent: string
  periodPrior: string | null
  items: Array<FinancialLineItem>
}

// Common XBRL concept name patterns → human-readable labels
const INCOME_STATEMENT_CONCEPTS: Record<string, string> = {
  Revenues: 'Revenue',
  RevenueFromContractWithCustomerExcludingAssessedTax: 'Net Revenue',
  SalesRevenueNet: 'Net Sales',
  CostOfRevenue: 'Cost of Revenue',
  CostOfGoodsAndServicesSold: 'Cost of Goods Sold',
  GrossProfit: 'Gross Profit',
  ResearchAndDevelopmentExpense: 'Research & Development',
  SellingGeneralAndAdministrativeExpense: 'Selling, General & Administrative',
  OperatingExpenses: 'Total Operating Expenses',
  OperatingIncomeLoss: 'Operating Income',
  InterestExpense: 'Interest Expense',
  IncomeTaxExpenseBenefit: 'Income Tax Expense',
  NetIncomeLoss: 'Net Income',
  EarningsPerShareBasic: 'Earnings Per Share (Basic)',
  EarningsPerShareDiluted: 'Earnings Per Share (Diluted)',
  WeightedAverageNumberOfShareOutstandingBasicAndDiluted: 'Shares Outstanding',
}

const BALANCE_SHEET_CONCEPTS: Record<string, string> = {
  CashAndCashEquivalentsAtCarryingValue: 'Cash & Cash Equivalents',
  ShortTermInvestments: 'Short-Term Investments',
  AccountsReceivableNetCurrent: 'Accounts Receivable',
  InventoryNet: 'Inventory',
  AssetsCurrent: 'Total Current Assets',
  PropertyPlantAndEquipmentNet: 'Property, Plant & Equipment',
  Goodwill: 'Goodwill',
  IntangibleAssetsNetExcludingGoodwill: 'Intangible Assets',
  Assets: 'Total Assets',
  AccountsPayableCurrent: 'Accounts Payable',
  LongTermDebt: 'Long-Term Debt',
  LongTermDebtNoncurrent: 'Long-Term Debt',
  LiabilitiesCurrent: 'Total Current Liabilities',
  Liabilities: 'Total Liabilities',
  StockholdersEquity: "Stockholders' Equity",
  RetainedEarningsAccumulatedDeficit: 'Retained Earnings',
  LiabilitiesAndStockholdersEquity: "Total Liabilities & Equity",
}

const CASH_FLOW_CONCEPTS: Record<string, string> = {
  NetCashProvidedByUsedInOperatingActivities: 'Cash from Operations',
  NetCashProvidedByUsedInInvestingActivities: 'Cash from Investing',
  NetCashProvidedByUsedInFinancingActivities: 'Cash from Financing',
  CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect:
    'Net Change in Cash',
  PaymentsToAcquirePropertyPlantAndEquipment: 'Capital Expenditures',
  PaymentsOfDividends: 'Dividends Paid',
  PaymentsForRepurchaseOfCommonStock: 'Stock Buybacks',
  DepreciationDepletionAndAmortization: 'Depreciation & Amortization',
}

const EQUITY_CONCEPTS: Record<string, string> = {
  CommonStockValue: 'Common Stock',
  AdditionalPaidInCapital: 'Additional Paid-In Capital',
  RetainedEarningsAccumulatedDeficit: 'Retained Earnings',
  AccumulatedOtherComprehensiveIncomeLossNetOfTax:
    'Accumulated Other Comprehensive Income/Loss',
  TreasuryStockValue: 'Treasury Stock',
  StockholdersEquity: "Total Stockholders' Equity",
}

/**
 * Extract all financial statements from XBRL data.
 * Returns structured data — no AI needed.
 */
export function transformXbrlToStatements(
  xbrlData: Record<string, unknown>,
): Record<string, FinancialStatement> {
  const result: Record<string, FinancialStatement> = {}

  const incomeStatement = extractStatement(
    xbrlData,
    'StatementsOfIncome',
    'Income Statement',
    INCOME_STATEMENT_CONCEPTS,
  )
  if (incomeStatement) result.income_statement = incomeStatement

  const balanceSheet = extractStatement(
    xbrlData,
    'BalanceSheets',
    'Balance Sheet',
    BALANCE_SHEET_CONCEPTS,
  )
  if (balanceSheet) result.balance_sheet = balanceSheet

  const cashFlow = extractStatement(
    xbrlData,
    'StatementsOfCashFlows',
    'Cash Flow Statement',
    CASH_FLOW_CONCEPTS,
  )
  if (cashFlow) result.cash_flow = cashFlow

  const equity = extractStatement(
    xbrlData,
    'StatementsOfShareholdersEquity',
    "Shareholders' Equity",
    EQUITY_CONCEPTS,
  )
  if (equity) result.shareholders_equity = equity

  return result
}

function extractStatement(
  xbrlData: Record<string, unknown>,
  statementKey: string,
  title: string,
  conceptMap: Record<string, string>,
): FinancialStatement | null {
  // XBRL JSON may have the key directly or with variations
  const statementData = findStatementData(xbrlData, statementKey)
  if (!statementData) return null

  const items: Array<FinancialLineItem> = []
  let periodCurrent = ''
  let periodPrior: string | null = null

  for (const [concept, label] of Object.entries(conceptMap)) {
    const values = extractConceptValues(statementData, concept)
    if (!values) continue

    const periods = Object.keys(values).sort().reverse()
    if (periods.length === 0) continue

    if (!periodCurrent && periods[0]) {
      periodCurrent = periods[0]
    }
    if (!periodPrior && periods.length > 1 && periods[1]) {
      periodPrior = periods[1]
    }

    const current = parseNumericValue(values[periods[0]])
    const prior = periods.length > 1 ? parseNumericValue(values[periods[1]]) : null

    let change: number | null = null
    let changePercent: number | null = null
    if (current != null && prior != null && prior !== 0) {
      change = current - prior
      changePercent = Math.round((change / Math.abs(prior)) * 10000) / 100
    }

    items.push({ label, current, prior, change, changePercent })
  }

  if (items.length === 0) return null

  return { title, periodCurrent, periodPrior, items }
}

function findStatementData(
  xbrlData: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  // Direct key match
  if (xbrlData[key] && typeof xbrlData[key] === 'object') {
    return xbrlData[key] as Record<string, unknown>
  }

  // Try common XBRL variations
  const variations = [
    key,
    `${key}Parenthetical`,
    key.replace('Statements', 'Statement'),
    `Consolidated${key}`,
  ]

  for (const variant of variations) {
    for (const k of Object.keys(xbrlData)) {
      if (k.toLowerCase().includes(variant.toLowerCase())) {
        const val = xbrlData[k]
        if (val && typeof val === 'object') {
          return val as Record<string, unknown>
        }
      }
    }
  }

  return null
}

function extractConceptValues(
  statementData: Record<string, unknown>,
  concept: string,
): Record<string, unknown> | null {
  // Direct match
  if (statementData[concept] && typeof statementData[concept] === 'object') {
    return statementData[concept] as Record<string, unknown>
  }

  // Check for us-gaap prefixed keys
  for (const key of Object.keys(statementData)) {
    if (key === concept || key.endsWith(`:${concept}`) || key === `us-gaap:${concept}`) {
      const val = statementData[key]
      if (val && typeof val === 'object') {
        return val as Record<string, unknown>
      }
    }
  }

  return null
}

function parseNumericValue(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/,/g, ''))
    return Number.isNaN(parsed) ? null : parsed
  }
  // XBRL may wrap values in objects with a 'value' key
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return parseNumericValue((value as Record<string, unknown>).value)
  }
  return null
}
