/** SEC filing form types */
export const FilingType = {
  FORM_10K: '10-K',
  FORM_10Q: '10-Q',
  FORM_8K: '8-K',
  DEF_14A: 'DEF 14A',
  FORM_3: '3',
  FORM_4: '4',
  FORM_5: '5',
  FORM_S1: 'S-1',
  FORM_424B4: '424B4',
  FORM_13F: '13F-HR',
  FORM_13D: 'SC 13D',
  FORM_13G: 'SC 13G',
  FORM_144: '144',
  FORM_D: 'D',
  FORM_C: 'C',
} as const

export type FilingType = (typeof FilingType)[keyof typeof FilingType]

/** 10-K section item codes */
export const TenKSection = {
  BUSINESS_OVERVIEW: '1',
  RISK_FACTORS: '1A',
  UNRESOLVED_STAFF_COMMENTS: '1B',
  CYBERSECURITY: '1C',
  PROPERTIES: '2',
  LEGAL_PROCEEDINGS: '3',
  MINE_SAFETY: '4',
  MARKET_INFO: '5',
  SELECTED_FINANCIAL: '6',
  MD_AND_A: '7',
  QUANTITATIVE_DISCLOSURES: '7A',
  FINANCIAL_STATEMENTS: '8',
  DISAGREEMENTS_WITH_ACCOUNTANTS: '9',
  CONTROLS_AND_PROCEDURES: '9A',
  OTHER_INFO: '9B',
  DIRECTORS_AND_GOVERNANCE: '10',
  EXECUTIVE_COMPENSATION: '11',
  SECURITY_OWNERSHIP: '12',
  RELATED_TRANSACTIONS: '13',
  ACCOUNTANT_FEES: '14',
  EXHIBITS: '15',
} as const

export type TenKSection = (typeof TenKSection)[keyof typeof TenKSection]

/** 10-Q section item codes */
export const TenQSection = {
  FINANCIAL_STATEMENTS: 'part1item1',
  MD_AND_A: 'part1item2',
  QUANTITATIVE_DISCLOSURES: 'part1item3',
  CONTROLS_AND_PROCEDURES: 'part1item4',
  LEGAL_PROCEEDINGS: 'part2item1',
  RISK_FACTORS: 'part2item1a',
  UNREGISTERED_SALES: 'part2item2',
  DEFAULTS: 'part2item3',
  MINE_SAFETY: 'part2item4',
  OTHER_INFO: 'part2item5',
  EXHIBITS: 'part2item6',
} as const

export type TenQSection = (typeof TenQSection)[keyof typeof TenQSection]

/** 8-K section item codes */
export const EightKSection = {
  ENTRY_AGREEMENT: '1-1',
  BANKRUPTCY: '1-2',
  MINE_SAFETY: '1-3',
  RESULTS_OF_OPERATIONS: '2-2',
  CREATION_OF_OBLIGATION: '2-3',
  EXIT_ACTIVITIES: '2-5',
  MATERIAL_IMPAIRMENTS: '2-6',
  DELISTING: '3-1',
  UNREGISTERED_SALES: '3-2',
  MATERIAL_MODIFICATION: '3-3',
  AUDITOR_CHANGES: '4-1',
  FINANCIAL_RESTATEMENTS: '4-2',
  DIRECTOR_OFFICER_CHANGES: '5-2',
  AMENDMENTS_TO_ARTICLES: '5-3',
  CODE_OF_ETHICS: '5-5',
  ABS_INFO: '6-1',
  REG_FD_DISCLOSURE: '7-1',
  OTHER_EVENTS: '8-1',
  FINANCIAL_EXHIBITS: '9-1',
  SIGNATURE: 'signature',
} as const

export type EightKSection = (typeof EightKSection)[keyof typeof EightKSection]

/** All section item types */
export type SectionItem = TenKSection | TenQSection | EightKSection

/** SEC API base URLs */
export const SEC_API_BASE_URL = 'https://api.sec-api.io'

/** Default page size */
export const DEFAULT_PAGE_SIZE = 50

/** Maximum page size */
export const MAX_PAGE_SIZE = 50

/** Maximum pagination offset */
export const MAX_OFFSET = 10_000

/**
 * Elasticsearch-style query DSL used by sec-api.io search endpoints.
 * Supports Lucene query strings along with pagination and sorting.
 */
export interface ElasticsearchQuery {
  /** Lucene query string (max 3500 chars) */
  query: string
  /** Pagination offset (default: "0", max: "10000") */
  from?: string
  /** Results per page (default: "50", max: "50") */
  size?: string
  /** Sort order array */
  sort?: Array<Record<string, { order: 'asc' | 'desc' }>>
}
