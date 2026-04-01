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
  // Standard corporate
  Revenues: 'Revenue',
  RevenueFromContractWithCustomerExcludingAssessedTax: 'Net Revenue',
  RevenueFromContractWithCustomerIncludingAssessedTax: 'Net Revenue',
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
  // Bank / financial institution
  InterestIncome: 'Interest Income',
  InterestIncomeExpenseNet: 'Net Interest Income',
  NoninterestRevenue: 'Non-Interest Revenue',
  NoninterestExpense: 'Non-Interest Expense',
  InvestmentBankingRevenue: 'Investment Banking Revenue',
  PrincipalTransactionsRevenue: 'Principal Transactions Revenue',
  LendingAndDepositRelatedFees: 'Lending & Deposit Fees',
  ProvisionForCreditLosses: 'Provision for Credit Losses',
  ProvisionForLoanLeaseAndCreditLosses: 'Provision for Loan Losses',
  // REIT / real estate
  CorporateExpensesExcludingDepreciationAndAmortization: 'Corporate Expenses (ex D&A)',
  RealEstateRevenueNet: 'Real Estate Revenue (Net)',
  OperatingLeasesIncomeStatementLeaseRevenue: 'Lease Revenue',
  RentalRevenue: 'Rental Revenue',
  OtherRealEstateRevenue: 'Other Real Estate Revenue',
  DirectCostsOfLeasedAndRentedPropertyOrEquipment: 'Direct Costs of Leased Property',
  ImpairmentOfRealEstate: 'Impairment of Real Estate',
  GainLossOnSaleOfProperties: 'Gain/Loss on Sale of Properties',
  // Insurance
  PremiumsEarnedNet: 'Net Premiums Earned',
  PolicyholderBenefitsAndClaimsIncurredNet: 'Policyholder Benefits & Claims',
  InsuranceCommissionsAndFees: 'Insurance Commissions & Fees',
  // Utilities
  ElectricUtilityRevenue: 'Electric Utility Revenue',
  RegulatedElectricRevenue: 'Regulated Electric Revenue',
  // General (common across industries)
  DepreciationAndAmortization: 'Depreciation & Amortization',
  GeneralAndAdministrativeExpense: 'General & Administrative',
  IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest:
    'Income Before Taxes',
  IncomeLossFromContinuingOperations: 'Income from Continuing Operations',
  OtherOperatingIncomeExpenseNet: 'Other Operating Income (Net)',
  // General (common across S&P 500)
  CostOfServices: 'Cost of Services',
  RestructuringCharges: 'Restructuring Charges',
  AssetImpairmentCharges: 'Asset Impairment Charges',
  AmortizationOfIntangibleAssets: 'Amortization of Intangible Assets',
  GoodwillImpairmentLoss: 'Goodwill Impairment',
  OtherNonoperatingIncomeExpense: 'Other Non-Operating Income/Expense',
  StockBasedCompensation: 'Stock-Based Compensation',
  IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments:
    'Income Before Taxes',
  // Tech / SaaS
  SubscriptionRevenue: 'Subscription Revenue',
  ServiceRevenue: 'Service Revenue',
  ProductRevenue: 'Product Revenue',
  LicenseRevenue: 'License Revenue',
  // Pharma / Biotech
  LicenseAndServicesRevenue: 'License & Services Revenue',
  CollaborationRevenue: 'Collaboration Revenue',
  // Oil & Gas
  OilAndGasRevenue: 'Oil & Gas Revenue',
  ExplorationExpense: 'Exploration Expense',
  // Healthcare
  PatientServiceRevenue: 'Patient Service Revenue',
  PremiumRevenue: 'Premium Revenue',
  HealthCareOrganizationRevenue: 'Healthcare Revenue',
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
  // Bank / financial institution
  Deposits: 'Deposits',
  FinanceReceivablesNet: 'Finance Receivables (Net)',
  LoansAndLeasesReceivableNetReportedAmount: 'Loans & Leases (Net)',
  AllowanceForCreditLosses: 'Allowance for Credit Losses',
  TradingSecurities: 'Trading Securities',
  AvailableForSaleSecurities: 'Available-for-Sale Securities',
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

  // Try StatementsOfIncome first, fall back to StatementsOfComprehensiveIncome
  // (some companies like DIN put the full P&L in comprehensive income)
  const incomeStatement =
    extractStatement(xbrlData, 'StatementsOfIncome', 'Income Statement', INCOME_STATEMENT_CONCEPTS) ??
    extractStatement(xbrlData, 'StatementsOfComprehensiveIncome', 'Income Statement', INCOME_STATEMENT_CONCEPTS)
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

  // Try common XBRL variations (exact match, case-insensitive)
  const keyLower = key.toLowerCase()
  const variations = [
    keyLower,
    `consolidated${keyLower}`,
    keyLower.replace('statements', 'statement'),
    `consolidated${keyLower.replace('statements', 'statement')}`,
  ]

  for (const k of Object.keys(xbrlData)) {
    const kLower = k.toLowerCase()
    if (variations.includes(kLower)) {
      const val = xbrlData[k]
      if (val && typeof val === 'object') {
        return val as Record<string, unknown>
      }
    }
  }

  return null
}

function extractConceptValues(
  statementData: Record<string, unknown>,
  concept: string,
): Record<string, unknown> | null {
  let raw: unknown = null

  // Direct match
  if (statementData[concept] && typeof statementData[concept] === 'object') {
    raw = statementData[concept]
  }

  // Check for us-gaap prefixed keys
  if (!raw) {
    for (const key of Object.keys(statementData)) {
      if (key === concept || key.endsWith(`:${concept}`) || key === `us-gaap:${concept}`) {
        const val = statementData[key]
        if (val && typeof val === 'object') {
          raw = val
          break
        }
      }
    }
  }

  if (!raw) return null

  // SEC API returns arrays for concepts with dimensional/segment breakdowns.
  // Each element has { value, period: { endDate, startDate }, segment? }.
  // Filter for non-segmented entries (consolidated totals) and build period→value map.
  if (Array.isArray(raw)) {
    const result: Record<string, unknown> = {}
    for (const entry of raw) {
      if (typeof entry !== 'object' || entry === null) continue
      const e = entry as Record<string, unknown>
      // Skip segmented values — only keep consolidated totals
      if (e.segment) continue
      const period = e.period as Record<string, string> | undefined
      const endDate = period?.endDate
      if (endDate && e.value != null) {
        result[endDate] = e.value
      }
    }
    return Object.keys(result).length > 0 ? result : null
  }

  return raw as Record<string, unknown>
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
