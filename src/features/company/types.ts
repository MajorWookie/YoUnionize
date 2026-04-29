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
  nonEquityIncentive: number | null
  otherCompensation: number | null
  changeInPensionValue: number | null
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
  age: number | null
  directorClass: string | null
  qualifications: unknown
  role: string | null
}

export interface CompanyDetailResponse {
  company: CompanyInfo
  status: CompanyStatus
  latestAnnual: FilingSummaryData | null
  latestQuarterly: FilingSummaryData | null
  latestProxy: { id: string; periodEnd: string | null; summary: Record<string, unknown> } | null
  recentEvents: Array<{ id: string; filedAt: string; summary: Record<string, unknown> }>
  availableFiscalYears: Array<number>
  selectedFiscalYear: number | null
  executives: Array<ExecutiveData>
  insiderTrades: Array<InsiderTradeData>
  directors: Array<DirectorData>
}

// AI summary shapes — re-exported from packages/ai (the source of truth).
// Keep this file as the single barrel the company UI imports from, but don't
// duplicate the definitions here.
export type {
  FilingSummaryResult,
  CompanySummaryResult,
  EmployeeImpactResult,
} from '@younionize/ai'

// Financial statement shapes — re-exported from the XBRL transformer (the
// only place that produces them).
export type {
  FinancialLineItem,
  FinancialStatement,
} from '~/server/services/xbrl-transformer'

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
