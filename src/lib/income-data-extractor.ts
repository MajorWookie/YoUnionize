/**
 * Extracts structured sunburst chart data from XBRL income statement line items.
 * Produces 2-3 concentric ring data structures:
 *   Ring 1 (outer): Revenue sub-categories (if available)
 *   Ring 2 (middle): Operating Expenses vs Operating Income
 *   Ring 3 (inner): Income waterfall (interest, non-operating, tax, net income)
 */
import type { FinancialStatement, FinancialLineItem } from '~/lib/financial-types'
import { formatDollarsCompact as formatFinancial } from '~/lib/format'

// ── Types ──────────────────────────────────────────────────────────────

export interface SunburstSlice {
  id: string
  label: string
  /** Absolute value used for arc width (always >= 0) */
  value: number
  /** Original signed value */
  rawValue: number
  formattedValue: string
  percentOfRevenue: number
  color: string
  isNegative: boolean
  /** For the Operating Expenses slice: itemized breakdown */
  breakdown?: Array<BreakdownItem>
}

export interface BreakdownItem {
  label: string
  value: number
  formattedValue: string
  percentOfRevenue: number
}

export interface SunburstRing {
  slices: SunburstSlice[]
  /** If set, this ring only spans the angular range of the parent slice */
  constrainedToSliceId?: string
}

export interface SunburstYearData {
  year: string
  periodLabel: string
  totalRevenue: number
  formattedRevenue: string
  rings: SunburstRing[]
}

// ── Helpers ───────────────────────────────────────────────────────────

const FOUR_DIGIT_YEAR_RE = /\b(19|20)\d{2}\b/

/**
 * Extract a 4-digit calendar year from a period string.
 * Handles ISO dates ("2024-09-28"), bare years ("2024"), and other formats.
 * Returns null if no year can be found.
 */
function extractYear(dateStr: string): string | null {
  // ISO date: "2024-09-28" or "2024-12-31"
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr.slice(0, 4)
  // Any embedded 4-digit year
  const match = FOUR_DIGIT_YEAR_RE.exec(dateStr)
  if (match) return match[0]
  return null
}

// ── Color palette ──────────────────────────────────────────────────────

const REVENUE_COLORS = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af']
const OPEX_COLOR = '#f59e0b'
const OPEX_SUB_COLORS = ['#f59e0b', '#d97706', '#b45309', '#92400e', '#fbbf24', '#f97316']
const OPERATING_INCOME_COLOR = '#9ca3af'
const INTEREST_EXPENSE_COLOR = '#f87171'
const NON_OP_POSITIVE_COLOR = '#4ade80'
const NON_OP_NEGATIVE_COLOR = '#f87171'
const TAX_COLOR = '#a78bfa'
const NET_INCOME_COLOR = '#10b981'
const NET_LOSS_COLOR = '#ef4444'

// ── Label classification ───────────────────────────────────────────────

type ItemCategory =
  | 'total-revenue'
  | 'revenue-sub'
  | 'cost-of-revenue'
  | 'gross-profit'
  | 'opex-item'
  | 'total-opex'
  | 'operating-income'
  | 'pre-tax-income'
  | 'interest-expense'
  | 'interest-income'
  | 'tax'
  | 'net-income'
  | 'eps'
  | 'shares'
  | 'other'

function categorize(label: string): ItemCategory {
  const l = label.toLowerCase().trim()

  // Revenue totals (standard + REIT, insurance, utilities)
  if (
    /^(total\s+)?(net\s+)?(revenue|sales)$|^real\s+estate\s+revenue|^electric\s+utility\s+revenue|^regulated\s+electric\s+revenue|^net\s+premiums\s+earned$|^healthcare\s+revenue$|^patient\s+service\s+revenue$|^oil\s+and\s+gas\s+revenue$|^premium\s+revenue$/.test(
      l,
    )
  )
    return 'total-revenue'

  // Cost items
  if (/cost\s+of\s+(revenue|goods|sales|services)/.test(l)) return 'cost-of-revenue'
  if (/^gross\s+profit$/.test(l)) return 'gross-profit'

  // Operating totals
  if (/^(total\s+)?operating\s+expenses$/.test(l)) return 'total-opex'
  if (/^operating\s+(income|loss)/.test(l)) return 'operating-income'
  if (/^income\s+before\s+taxes|^income\s+from\s+continuing/.test(l)) return 'pre-tax-income'

  // Below-the-line
  if (/^interest\s+expense/.test(l)) return 'interest-expense'
  if (/^(net\s+)?interest\s+income/.test(l) && !/expense/.test(l)) return 'interest-income'
  if (/income\s+tax|provision\s+for\s+income/.test(l)) return 'tax'
  if (/^net\s+(income|loss|earnings)/.test(l)) return 'net-income'

  // Per-share / shares
  if (/earnings\s+per\s+share|^eps/i.test(l)) return 'eps'
  if (/shares?\s+outstanding/.test(l)) return 'shares'

  // Operating expense items (guard: skip if label also contains "revenue" or "income")
  if (
    !/revenue|income/.test(l) &&
    /research|development|selling|general|admin|depreciation|amortization|marketing|restructuring|impairment|provision\s+for\s+(credit|loan)|direct\s+costs|policyholder|benefits.*claims|corporate\s+expenses|stock.based\s+comp|exploration/.test(
      l,
    )
  )
    return 'opex-item'

  // Revenue sub-items (banks, diversified companies)
  if (/revenue|sales|^non-?interest\s+revenue|^investment\s+banking|^rental|^lease\s+revenue|^premiums?\s+earned|^insurance\s+commissions|^subscription|^service\s+revenue|^product\s+revenue|^license|^collaboration/.test(l)) return 'revenue-sub'

  return 'other'
}

// ── Main extraction ────────────────────────────────────────────────────

/**
 * Extract sunburst data for all available years from a financial statement.
 * Returns 1-2 year datasets (current period, and prior period if available).
 *
 * @param periodEnd - The filing's period end date (e.g. "2024-09-28"), used as
 *   a reliable fallback when XBRL period keys don't contain parseable years.
 *   For non-calendar fiscal years the year from periodEnd naturally represents
 *   the latter year (e.g. Apple FY ending Sep 2024 → "FY 2024").
 */
export function extractSunburstYears(
  statement: FinancialStatement,
  periodEnd?: string | null,
): SunburstYearData[] {
  const years: SunburstYearData[] = []

  const currentYear = extractForPeriod(statement, 'current', periodEnd)
  if (currentYear) years.push(currentYear)

  const priorYear = extractForPeriod(statement, 'prior', periodEnd)
  if (priorYear) years.push(priorYear)

  return years
}

function extractForPeriod(
  statement: FinancialStatement,
  period: 'current' | 'prior',
  periodEnd?: string | null,
): SunburstYearData | null {
  const periodDate = period === 'current' ? statement.periodCurrent : statement.periodPrior
  if (!periodDate) return null

  const getValue = (item: FinancialLineItem): number | null =>
    period === 'current' ? item.current : item.prior

  // Find anchors — when multiple items categorize as total-revenue (e.g. REITs
  // with both "Revenue" sub-segment and "Real Estate Revenue (Net)" aggregate),
  // pick the one with the largest value for the current period.
  const totalRevenueCandidates = statement.items.filter((i) => categorize(i.label) === 'total-revenue')
  const totalRevenueItem = totalRevenueCandidates.length > 1
    ? totalRevenueCandidates.reduce<FinancialLineItem | null>((best, item) => {
        const val = getValue(item) ?? 0
        const bestVal = best ? (getValue(best) ?? 0) : -1
        return val > bestVal ? item : best
      }, null)
    : totalRevenueCandidates[0] ?? null
  // Prefer true operating income; fall back to pre-tax income (post-interest)
  let operatingIncomeItem = statement.items.find(
    (i) => categorize(i.label) === 'operating-income',
  )
  let anchorIsPreTax = false
  if (!operatingIncomeItem) {
    operatingIncomeItem = statement.items.find(
      (i) => categorize(i.label) === 'pre-tax-income',
    )
    anchorIsPreTax = true
  }
  const netIncomeItem = statement.items.find((i) => categorize(i.label) === 'net-income')

  const totalRevenue = getValue(totalRevenueItem ?? { label: '', current: null, prior: null, change: null, changePercent: null })
  if (!totalRevenue || totalRevenue <= 0) return null

  const operatingIncome = getValue(operatingIncomeItem ?? { label: '', current: null, prior: null, change: null, changePercent: null })
  const netIncome = getValue(netIncomeItem ?? { label: '', current: null, prior: null, change: null, changePercent: null })

  // Need at least Operating/Pre-Tax Income or Net Income to build anything useful
  if (operatingIncome == null && netIncome == null) return null

  const rings: SunburstRing[] = []

  // ── Ring 1: Revenue Breakdown ──────────────────────────────────────
  const revenueSubItems = statement.items.filter((i) => {
    const cat = categorize(i.label)
    return cat === 'revenue-sub' && getValue(i) != null && getValue(i)! > 0
  })

  if (revenueSubItems.length >= 2) {
    rings.push({
      slices: revenueSubItems.map((item, idx) => {
        const val = getValue(item) ?? 0
        return {
          id: `rev-${idx}`,
          label: item.label,
          value: Math.abs(val),
          rawValue: val,
          formattedValue: formatFinancial(val),
          percentOfRevenue: round((val / totalRevenue) * 100),
          color: REVENUE_COLORS[idx % REVENUE_COLORS.length],
          isNegative: val < 0,
        }
      }),
    })
  }

  // ── Ring 2: Revenue Disposition ────────────────────────────────────
  const opIncVal = operatingIncome ?? (netIncome ?? 0)
  const opExpVal = totalRevenue - opIncVal

  // Collect individual expense items for the popover breakdown
  const expenseItems: BreakdownItem[] = []
  for (const item of statement.items) {
    const cat = categorize(item.label)
    if (cat === 'cost-of-revenue' || cat === 'opex-item') {
      const v = getValue(item)
      if (v != null && v !== 0) {
        expenseItems.push({
          label: item.label,
          value: Math.abs(v),
          formattedValue: formatFinancial(Math.abs(v)),
          percentOfRevenue: round((Math.abs(v) / totalRevenue) * 100),
        })
      }
    }
  }

  const ring2Slices: SunburstSlice[] = []

  if (opExpVal > 0) {
    ring2Slices.push({
      id: 'opex',
      label: 'Operating Expenses',
      value: opExpVal,
      rawValue: opExpVal,
      formattedValue: formatFinancial(opExpVal),
      percentOfRevenue: round((opExpVal / totalRevenue) * 100),
      color: OPEX_COLOR,
      isNegative: false,
      breakdown: expenseItems.length > 0 ? expenseItems : undefined,
    })
  }

  if (opIncVal > 0) {
    ring2Slices.push({
      id: 'operating-income',
      label: anchorIsPreTax ? 'Income Before Taxes' : 'Operating Income',
      value: opIncVal,
      rawValue: opIncVal,
      formattedValue: formatFinancial(opIncVal),
      percentOfRevenue: round((opIncVal / totalRevenue) * 100),
      color: OPERATING_INCOME_COLOR,
      isNegative: false,
    })
  } else if (opIncVal < 0) {
    // Operating loss: entire revenue is consumed by expenses (and then some)
    ring2Slices.push({
      id: 'operating-income',
      label: anchorIsPreTax ? 'Loss Before Taxes' : 'Operating Loss',
      value: Math.abs(opIncVal),
      rawValue: opIncVal,
      formattedValue: formatFinancial(opIncVal),
      percentOfRevenue: round((Math.abs(opIncVal) / totalRevenue) * 100),
      color: NET_LOSS_COLOR,
      isNegative: true,
    })
  }

  if (ring2Slices.length < 1) return null
  rings.push({ slices: ring2Slices })

  // ── Ring 3a: Operating Expenses Breakdown (within OpEx span) ───────
  if (expenseItems.length >= 2 && opExpVal > 0) {
    const knownTotal = expenseItems.reduce((s, item) => s + item.value, 0)
    const remainder = opExpVal - knownTotal

    const opexSubSlices: SunburstSlice[] = expenseItems.map((item, idx) => ({
      id: `opex-${idx}`,
      label: item.label,
      value: item.value,
      rawValue: item.value,
      formattedValue: item.formattedValue,
      percentOfRevenue: item.percentOfRevenue,
      color: OPEX_SUB_COLORS[idx % OPEX_SUB_COLORS.length],
      isNegative: false,
    }))

    if (remainder > 0.5) {
      opexSubSlices.push({
        id: 'opex-other',
        label: 'Other Operating Expenses',
        value: remainder,
        rawValue: remainder,
        formattedValue: formatFinancial(remainder),
        percentOfRevenue: round((remainder / totalRevenue) * 100),
        color: OPEX_SUB_COLORS[opexSubSlices.length % OPEX_SUB_COLORS.length],
        isNegative: false,
      })
    }

    rings.push({ slices: opexSubSlices, constrainedToSliceId: 'opex' })
  }

  // ── Ring 3b: Income Waterfall (within Operating Income span) ───────
  if (opIncVal > 0) {
    const interestExpItem = statement.items.find(
      (i) => categorize(i.label) === 'interest-expense',
    )
    const taxItem = statement.items.find((i) => categorize(i.label) === 'tax')

    // When anchor is pre-tax income, interest is already deducted — skip it
    const interest = anchorIsPreTax
      ? 0
      : Math.abs(getValue(interestExpItem ?? { label: '', current: null, prior: null, change: null, changePercent: null }) ?? 0)
    const tax = Math.abs(getValue(taxItem ?? { label: '', current: null, prior: null, change: null, changePercent: null }) ?? 0)
    const ni = netIncome ?? 0

    // Residual: items between the anchor and net income not explicitly captured
    const nonOp = opIncVal - interest - tax - ni

    const ring3Slices: SunburstSlice[] = []

    if (interest > 0) {
      ring3Slices.push({
        id: 'interest-expense',
        label: 'Interest Expense',
        value: interest,
        rawValue: -interest,
        formattedValue: formatFinancial(interest),
        percentOfRevenue: round((interest / totalRevenue) * 100),
        color: INTEREST_EXPENSE_COLOR,
        isNegative: true,
      })
    }

    if (Math.abs(nonOp) > 0.5) {
      const isNeg = nonOp > 0 // positive nonOp means it's a cost reducing income
      ring3Slices.push({
        id: 'non-operating',
        label: nonOp > 0 ? 'Non-Operating Expense' : 'Non-Operating Income',
        value: Math.abs(nonOp),
        rawValue: -nonOp,
        formattedValue: formatFinancial(Math.abs(nonOp)),
        percentOfRevenue: round((Math.abs(nonOp) / totalRevenue) * 100),
        color: isNeg ? NON_OP_NEGATIVE_COLOR : NON_OP_POSITIVE_COLOR,
        isNegative: isNeg,
      })
    }

    if (tax > 0) {
      ring3Slices.push({
        id: 'tax',
        label: 'Income Tax',
        value: tax,
        rawValue: -tax,
        formattedValue: formatFinancial(tax),
        percentOfRevenue: round((tax / totalRevenue) * 100),
        color: TAX_COLOR,
        isNegative: true,
      })
    }

    if (ni >= 0) {
      ring3Slices.push({
        id: 'net-income',
        label: 'Net Income',
        value: Math.max(ni, 0.01),
        rawValue: ni,
        formattedValue: formatFinancial(ni),
        percentOfRevenue: round((ni / totalRevenue) * 100),
        color: NET_INCOME_COLOR,
        isNegative: false,
      })
    } else {
      ring3Slices.push({
        id: 'net-income',
        label: 'Net Loss',
        value: Math.abs(ni),
        rawValue: ni,
        formattedValue: formatFinancial(ni),
        percentOfRevenue: round((Math.abs(ni) / totalRevenue) * 100),
        color: NET_LOSS_COLOR,
        isNegative: true,
      })
    }

    if (ring3Slices.length > 0) {
      rings.push({
        slices: ring3Slices,
        constrainedToSliceId: 'operating-income',
      })
    }
  }

  // Resolve the fiscal year: try XBRL period key first, fall back to filing periodEnd
  let yearStr = extractYear(periodDate)
  if (!yearStr && period === 'current' && periodEnd) {
    yearStr = extractYear(periodEnd)
  }
  if (!yearStr && period === 'prior' && periodEnd) {
    const endYear = extractYear(periodEnd)
    if (endYear) yearStr = String(Number(endYear) - 1)
  }
  // Last resort: use raw periodDate (preserves previous behavior)
  if (!yearStr) yearStr = periodDate.slice(0, 4)

  return {
    year: yearStr,
    periodLabel: `FY ${yearStr}`,
    totalRevenue,
    formattedRevenue: formatFinancial(totalRevenue),
    rings,
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}
