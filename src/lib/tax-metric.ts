import type { FinancialLineItem, FinancialStatement } from './financial-types'
import { metricDelta, type MetricDelta } from './metric-delta'

export type TaxesSource =
  | 'income_statement'
  | 'cash_flow'
  | 'derived'
  | 'prior_year'
  | 'fallback'

export interface ResolvedTaxes {
  label: 'Taxes' | 'Tax benefit'
  displayValue: string
  hint: string
  source: TaxesSource
  /** Optional YoY delta — present when current and prior values both exist. */
  delta?: MetricDelta
}

export interface RevenueRef {
  value: number
  period: string | null
}

const fmtCompact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function norm(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
}

function isTopLevelIncomeTaxLabel(label: string): boolean {
  const l = norm(label)
  if (/\b(deferred|foreign|federal|state|local|current)\b/.test(l)) return false
  return (
    /^provision for( income)? tax(es)?$/.test(l) ||
    /^(income )?tax(es)?( expense| provision)?$/.test(l) ||
    /^benefit from( income)? tax(es)?$/.test(l) ||
    /^income tax(es)? benefit$/.test(l) ||
    /^tax (expense|benefit|provision)$/.test(l) ||
    /^benefit provision for( income)? tax(es)?$/.test(l)
  )
}

function isPreTaxIncomeLabel(label: string): boolean {
  const l = norm(label)
  if (/\b(deferred|foreign|federal|state)\b/.test(l)) return false
  return (
    /^(income|earnings) before( provision for)?( income)? tax(es)?$/.test(l) ||
    /^pre-?tax (income|earnings)$/.test(l)
  )
}

function isCashFlowTaxesPaidLabel(label: string): boolean {
  const l = norm(label)
  return (
    /^income tax(es)? paid$/.test(l) ||
    /^cash paid for( income)? tax(es)?$/.test(l) ||
    /^taxes paid( in cash)?$/.test(l)
  )
}

function isNetIncomeLabel(label: string): boolean {
  const l = norm(label)
  return /^net (income|loss|earnings)\b/.test(l)
}

function asStatement(value: unknown): FinancialStatement | null {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  if (!Array.isArray(obj.items)) return null
  return obj as unknown as FinancialStatement
}

function findItem(
  stmt: FinancialStatement | null,
  match: (label: string) => boolean,
): FinancialLineItem | null {
  if (!stmt) return null
  return stmt.items.find((i) => match(i.label)) ?? null
}

function ratioPart(value: number, denom: number, suffix: string): string {
  const pct = (value / denom) * 100
  return value >= 0
    ? `${pct.toFixed(1)}% of ${suffix}`
    : `${Math.abs(pct).toFixed(1)}% benefit on ${suffix}`
}

function buildRatioHint(
  value: number,
  revenue: RevenueRef | null,
  netIncome: number | null,
  preTax: number | null,
): string | null {
  const parts: Array<string> = []
  if (netIncome != null && netIncome > 0) {
    parts.push(ratioPart(value, netIncome, 'profit'))
  }
  if (revenue && revenue.value > 0) {
    parts.push(ratioPart(value, revenue.value, 'revenue'))
  }
  if (parts.length > 0) return parts.join(' · ')
  if (preTax != null && preTax > 0) {
    const pct = (value / preTax) * 100
    return value >= 0
      ? `${pct.toFixed(1)}% effective`
      : `${Math.abs(pct).toFixed(1)}% effective benefit`
  }
  return null
}

function formatHint(opts: {
  value: number
  source: TaxesSource
  revenue: RevenueRef | null
  netIncome: number | null
  preTax: number | null
  period: string | null
}): string {
  const ratio = buildRatioHint(opts.value, opts.revenue, opts.netIncome, opts.preTax)
  const base = ratio ?? opts.period ?? 'Tax provision'

  if (opts.source === 'prior_year') return `Prior year · ${base}`
  if (opts.source === 'cash_flow') return `${base} · cash paid`
  return base
}

function deltaFromPriorValue(current: number, prior: number | null): MetricDelta | undefined {
  if (prior == null || prior === 0) return undefined
  const changePercent = ((current - prior) / Math.abs(prior)) * 100
  return metricDelta(changePercent)
}

function buildResolved(opts: {
  value: number
  source: Exclude<TaxesSource, 'fallback'>
  revenue: RevenueRef | null
  netIncome: number | null
  preTax: number | null
  period: string | null
  delta?: MetricDelta
}): ResolvedTaxes {
  return {
    label: opts.value < 0 ? 'Tax benefit' : 'Taxes',
    displayValue: `$${fmtCompact.format(Math.abs(opts.value))}`,
    hint: formatHint(opts),
    source: opts.source,
    delta: opts.delta,
  }
}

export function resolveTaxes(
  summary: Record<string, unknown>,
  revenue: RevenueRef | null,
): ResolvedTaxes {
  const incomeStmt = asStatement(summary.income_statement)
  const cashFlow = asStatement(summary.cash_flow)

  const period = incomeStmt?.periodCurrent ?? cashFlow?.periodCurrent ?? null

  const preTaxItem = findItem(incomeStmt, isPreTaxIncomeLabel)
  const preTax = preTaxItem?.current ?? null

  const netIncomeItem = findItem(incomeStmt, isNetIncomeLabel)
  const netIncome = netIncomeItem?.current ?? null

  const taxItem = findItem(incomeStmt, isTopLevelIncomeTaxLabel)
  if (taxItem && taxItem.current != null) {
    return buildResolved({
      value: taxItem.current,
      source: 'income_statement',
      revenue,
      netIncome,
      preTax,
      period,
      delta: metricDelta(taxItem.changePercent),
    })
  }

  const cashTaxItem = findItem(cashFlow, isCashFlowTaxesPaidLabel)
  if (cashTaxItem && cashTaxItem.current != null) {
    return buildResolved({
      value: cashTaxItem.current,
      source: 'cash_flow',
      revenue,
      netIncome,
      preTax,
      period,
      delta: metricDelta(cashTaxItem.changePercent),
    })
  }

  if (
    preTaxItem &&
    preTaxItem.current != null &&
    netIncomeItem &&
    netIncomeItem.current != null
  ) {
    const derived = preTaxItem.current - netIncomeItem.current
    const priorDerived =
      preTaxItem.prior != null && netIncomeItem.prior != null
        ? preTaxItem.prior - netIncomeItem.prior
        : null
    return buildResolved({
      value: derived,
      source: 'derived',
      revenue,
      netIncome,
      preTax,
      period,
      delta: deltaFromPriorValue(derived, priorDerived),
    })
  }

  if (taxItem && taxItem.prior != null) {
    return buildResolved({
      value: taxItem.prior,
      source: 'prior_year',
      revenue,
      netIncome,
      preTax,
      period: incomeStmt?.periodPrior ?? null,
    })
  }

  return {
    label: 'Taxes',
    displayValue: '—',
    hint: 'Tax detail not in this filing',
    source: 'fallback',
  }
}
