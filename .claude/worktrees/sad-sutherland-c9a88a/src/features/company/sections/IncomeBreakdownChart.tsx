/**
 * Income statement breakdown as a donut pie chart.
 * Shows how revenue splits into Cost of Revenue, Operating Expenses, Tax, and Net Income.
 * Data comes from the XBRL-structured financial data in the filing summary.
 */
import { Paragraph, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import { PieChart, type PieSegment } from '~/interface/charts/PieChart'
import type { FinancialStatement, FinancialLineItem } from '../types'
import { formatFinancial } from '../format'

interface Props {
  summary: Record<string, unknown>
}

/** Try to find a line item by label (case-insensitive partial match) */
function findItem(items: Array<FinancialLineItem>, ...labels: Array<string>): FinancialLineItem | undefined {
  for (const label of labels) {
    const lower = label.toLowerCase()
    const found = items.find((i) => i.label.toLowerCase().includes(lower))
    if (found) return found
  }
  return undefined
}

const COLORS = {
  costOfRevenue: '#e53e3e',
  operatingExpenses: '#ed8936',
  tax: '#9f7aea',
  netIncome: '#069639',
  other: '#718096',
}

export function IncomeBreakdownChart({ summary }: Props) {
  const incomeStatement = summary.income_statement as FinancialStatement | undefined
  if (!incomeStatement?.items?.length) return null

  const items = incomeStatement.items

  const revenue = findItem(items, 'Total Revenue', 'Revenue', 'Net Revenue', 'Total Net Revenue')
  const costOfRevenue = findItem(items, 'Cost of Revenue', 'Cost of Goods Sold', 'Cost of Sales')
  const netIncome = findItem(items, 'Net Income', 'Net Earnings')
  const taxExpense = findItem(items, 'Income Tax', 'Tax Expense', 'Provision for Income Tax')

  // Need at least revenue and one breakdown item
  if (!revenue?.current || revenue.current <= 0) return null

  const totalRevenue = revenue.current
  const cor = costOfRevenue?.current ?? 0
  const tax = Math.abs(taxExpense?.current ?? 0)
  const ni = netIncome?.current ?? 0

  // Operating expenses = Revenue - Cost of Revenue - Tax - Net Income
  // This captures SG&A, R&D, depreciation, interest, and other items
  const opex = Math.max(totalRevenue - cor - tax - ni, 0)

  const segments: Array<PieSegment> = []

  if (cor > 0) {
    segments.push({
      label: 'Cost of Revenue',
      value: cor,
      formattedValue: formatFinancial(cor),
      color: COLORS.costOfRevenue,
    })
  }

  if (opex > 0) {
    segments.push({
      label: 'Operating Expenses',
      value: opex,
      formattedValue: formatFinancial(opex),
      color: COLORS.operatingExpenses,
    })
  }

  if (tax > 0) {
    segments.push({
      label: 'Tax',
      value: tax,
      formattedValue: formatFinancial(tax),
      color: COLORS.tax,
    })
  }

  if (ni > 0) {
    segments.push({
      label: 'Net Income',
      value: ni,
      formattedValue: formatFinancial(ni),
      color: COLORS.netIncome,
    })
  } else if (ni < 0) {
    // Net loss — still show it, but absorb into "other"
    segments.push({
      label: 'Net Loss',
      value: Math.abs(ni),
      formattedValue: formatFinancial(ni),
      color: COLORS.other,
    })
  }

  if (segments.length < 2) return null

  return (
    <YStack gap="$2">
      <Paragraph fontWeight="700" fontSize={16}>
        Income Breakdown
      </Paragraph>
      <Card>
        <PieChart
          segments={segments}
          centerValue={formatFinancial(totalRevenue)}
          centerLabel="Revenue"
        />
      </Card>
    </YStack>
  )
}
