/**
 * Types for company detail API response.
 * Mirrors the shape returned by GET /api/companies/[ticker]/detail
 */

export interface CompanyInfo {
  id: string
  ticker: string
  name: string
  cik: string
  sector: string | null
  industry: string | null
  exchange: string | null
}

export interface CompanyStatus {
  hasData: boolean
  totalFilings: number
  summarizedFilings: number
  pendingFilings: number
}

export interface FilingSummaryData {
  id: string
  filingType: string
  periodEnd: string | null
  filedAt: string
  summary: Record<string, unknown>
}

export interface ExecutiveData {
  id: string
  name: string
  title: string
  fiscalYear: number
  totalCompensation: number
  salary: number | null
  bonus: number | null
  stockAwards: number | null
  optionAwards: number | null
  ceoPayRatio: string | null
}

export interface InsiderTradeData {
  id: string
  filerName: string
  filerTitle: string | null
  transactionDate: string
  transactionType: string | null
  shares: string | null
  pricePerShare: string | null
  totalValue: number | null
}

export interface DirectorData {
  id: string
  name: string
  title: string
  isIndependent: boolean | null
  committees: unknown
  tenureStart: string | null
}

export interface CompanyDetailResponse {
  company: CompanyInfo
  status: CompanyStatus
  latestAnnual: FilingSummaryData | null
  latestQuarterly: FilingSummaryData | null
  latestProxy: { id: string; periodEnd: string | null; summary: Record<string, unknown> } | null
  recentEvents: Array<{ id: string; filedAt: string; summary: Record<string, unknown> }>
  executives: Array<ExecutiveData>
  insiderTrades: Array<InsiderTradeData>
  directors: Array<DirectorData>
}

// Shapes from the AI summary

export interface FilingSummaryResult {
  executive_summary: string
  key_numbers: Array<{ label: string; value: string; context: string }>
  plain_language_explanation: string
  red_flags: string[]
  opportunities: string[]
  employee_relevance: string
}

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

export interface ExecCompSummary {
  top5: Array<{
    name: string
    title: string
    totalCompensation: number
    salary: number | null
    stockAwards: number | null
  }>
  ceoPayRatio: string | null
  employeeCompAsRiskFactor: boolean
  analysis: string | null
}
