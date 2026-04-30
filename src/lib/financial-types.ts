/**
 * Shape of XBRL-derived financial statements as returned on
 * filing_summaries.ai_summary. Used by FinancialsSection and the
 * IncomeStatementSunburst income-data-extractor.
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
