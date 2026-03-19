import type { ElasticsearchQuery, SectionItem } from './sec-api.constants'

// ─── Client Config ──────────────────────────────────────────────────────────

export interface SecApiClientConfig {
  apiKey: string
  baseUrl?: string
}

// ─── Filing Query API ───────────────────────────────────────────────────────

export interface FilingQueryRequest extends ElasticsearchQuery {}

export interface Filing {
  id: string
  accessionNo: string
  cik: string
  ticker?: string
  companyName: string
  companyNameLong?: string
  formType: string
  description?: string
  filedAt: string
  linkToTxt?: string
  linkToHtml?: string
  linkToXbrl?: string
  linkToFilingDetails?: string
  entities?: Array<FilingEntity>
  documentFormatFiles?: Array<DocumentFile>
  dataFiles?: Array<DocumentFile>
  periodOfReport?: string
}

export interface FilingEntity {
  companyName: string
  cik: string
  ticker: string
  irsNo: string
  stateOfIncorporation: string
  fiscalYearEnd: string
  type: string
}

export interface DocumentFile {
  sequence: string
  description: string
  documentUrl: string
  type: string
  size: string
}

export interface FilingQueryResponse {
  total: { value: number; relation: string }
  filings: Array<Filing>
}

// ─── Full-Text Search API ───────────────────────────────────────────────────

export interface FullTextSearchRequest {
  query: string
  formTypes?: Array<string>
  startDate?: string
  endDate?: string
  ciks?: Array<string>
  page?: string
}

export interface FullTextSearchResult {
  id: string
  accessionNo: string
  cik: string
  ticker: string
  companyName: string
  formType: string
  filedAt: string
  documentUrl: string
  description: string
  highlight: string
}

export interface FullTextSearchResponse {
  total: { value: number; relation: string }
  filings: Array<FullTextSearchResult>
}

// ─── Section Extractor ──────────────────────────────────────────────────────

export interface SectionExtractorRequest {
  url: string
  item: SectionItem
  type?: 'text' | 'html'
}

// ─── XBRL-to-JSON Converter ────────────────────────────────────────────────

export type XbrlLookupBy =
  | { htmUrl: string }
  | { xbrlUrl: string }
  | { accessionNo: string }

export interface XbrlResponse {
  [statementName: string]: unknown
}

// ─── Executive Compensation ─────────────────────────────────────────────────

export interface ExecutiveCompensation {
  id?: string
  ticker?: string
  cik?: string
  name?: string
  position?: string
  year?: number
  /** In dollars (API returns dollars; client normalizes to cents) */
  salary?: number
  bonus?: number
  stockAwards?: number
  optionAwards?: number
  nonEquityIncentiveCompensation?: number
  changeInPensionValueAndDeferredEarnings?: number
  otherCompensation?: number
  total?: number
  ceoPayRatio?: string | null
  accessionNo?: string
  filedAt?: string
}

export interface ExecutiveCompensationResponse {
  data: Array<ExecutiveCompensation>
}

// ─── Directors & Board Members ──────────────────────────────────────────────

export interface Director {
  ticker: string
  cik: string
  companyName: string
  name: string
  position: string
  age: number | null
  directorClass: string | null
  dateFirstElected: string | null
  isIndependent: boolean
  committeeMemberships: Array<string>
  qualificationsAndExperience: Array<string>
  accessionNo: string
  filedAt: string
}

export interface DirectorsResponse {
  total: { value: number; relation: string }
  data: Array<Director>
}

// ─── Insider Trading (Form 3/4/5) ──────────────────────────────────────────

export interface InsiderTransaction {
  transactionDate: string
  transactionCode: string
  transactionDescription: string
  sharesTraded: number
  pricePerShare: number | null
  sharesOwnedAfter: number
  directOrIndirect: string
  securityTitle: string
}

export interface InsiderTrade {
  id: string
  accessionNo: string
  formType: string
  filedAt: string
  issuer: {
    cik: string
    name: string
    tradingSymbol: string
  }
  reportingOwner: {
    cik: string
    name: string
    isDirector: boolean
    isOfficer: boolean
    officerTitle: string
    isTenPercentOwner: boolean
  }
  nonDerivativeTable: {
    transactions: Array<InsiderTransaction>
  } | null
  derivativeTable: {
    transactions: Array<InsiderTransaction>
  } | null
  periodOfReport: string
}

export interface InsiderTradingResponse {
  total: { value: number; relation: string }
  transactions: Array<InsiderTrade>
}

// ─── Form 8-K Structured Data ───────────────────────────────────────────────

export interface Form8KItem401 {
  newAccountantName: string | null
  formerAccountantName: string | null
  engagementEndReason: string | null
  goingConcern: boolean | null
  reportedIcfrWeakness: boolean | null
  opinionType: string | null
}

export interface Form8KItem402 {
  restatementIsNecessary: boolean | null
  reasonsForRestatement: string | null
  impactIsMaterial: boolean | null
  materialWeaknessIdentified: boolean | null
  affectedReportingPeriods: Array<string>
  keyComponents: Array<string>
  identifiedIssues: Array<string>
}

export interface Form8KPersonnelChange {
  personName: string
  changeType: string
  position: string
  effectiveDate: string | null
}

export interface Form8KItem502 {
  personnelChanges: Array<Form8KPersonnelChange>
  bonusPlans: Array<unknown>
  organizationChanges: Array<unknown>
}

export interface Form8KFiling {
  id: string
  accessionNo: string
  cik: string
  ticker: string
  companyName: string
  formType: string
  filedAt: string
  items: {
    item401?: Form8KItem401
    item402?: Form8KItem402
    item502?: Form8KItem502
  }
}

export interface Form8KResponse {
  total: { value: number; relation: string }
  data: Array<Form8KFiling>
}

// ─── Data Mapping ───────────────────────────────────────────────────────────

export interface CompanyMapping {
  name: string
  ticker: string
  cik: string
  cusip: string
  exchange: string
  isDelisted: boolean
  category: string
  sector: string
  industry: string
  sic: string
  currency: string
  location: string
}

// ─── Pagination Helper ──────────────────────────────────────────────────────

export interface PaginationOptions {
  /** Starting offset (default: 0) */
  from?: number
  /** Page size (default: 50, max: 50) */
  size?: number
}
