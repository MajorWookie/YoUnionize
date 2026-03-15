import * as v from 'valibot'

// ─── Helpers ────────────────────────────────────────────────────────────────

const optionalString = v.optional(v.nullable(v.string()))
const optionalNumber = v.optional(v.nullable(v.number()))
const optionalBoolean = v.optional(v.nullable(v.boolean()))

// ─── Filing Query API ───────────────────────────────────────────────────────

export const FilingEntitySchema = v.object({
  companyName: v.pipe(v.string(), v.minLength(0)),
  cik: v.string(),
  ticker: v.string(),
  irsNo: v.optional(v.string()),
  stateOfIncorporation: v.optional(v.string()),
  fiscalYearEnd: v.optional(v.string()),
  type: v.optional(v.string()),
})

export const DocumentFileSchema = v.object({
  sequence: v.optional(v.string()),
  description: v.optional(v.string()),
  documentUrl: v.optional(v.string()),
  type: v.optional(v.string()),
  size: v.optional(v.string()),
})

export const FilingSchema = v.object({
  id: v.string(),
  accessionNo: v.string(),
  cik: v.string(),
  ticker: v.string(),
  companyName: v.string(),
  companyNameLong: v.optional(v.string()),
  formType: v.string(),
  description: v.optional(v.string()),
  filedAt: v.string(),
  linkToTxt: v.optional(v.string()),
  linkToHtml: v.optional(v.string()),
  linkToXbrl: v.optional(v.string()),
  linkToFilingDetails: v.optional(v.string()),
  entities: v.optional(v.array(FilingEntitySchema)),
  documentFormatFiles: v.optional(v.array(DocumentFileSchema)),
  dataFiles: v.optional(v.array(DocumentFileSchema)),
  periodOfReport: v.optional(v.string()),
})

export const FilingQueryResponseSchema = v.object({
  total: v.object({
    value: v.number(),
    relation: v.optional(v.string()),
  }),
  filings: v.array(FilingSchema),
})

// ─── Full-Text Search ───────────────────────────────────────────────────────

export const FullTextSearchResultSchema = v.object({
  id: v.optional(v.string()),
  accessionNo: v.optional(v.string()),
  cik: v.optional(v.string()),
  ticker: v.optional(v.string()),
  companyName: v.optional(v.string()),
  formType: v.optional(v.string()),
  filedAt: v.optional(v.string()),
  documentUrl: v.optional(v.string()),
  description: v.optional(v.string()),
  highlight: v.optional(v.string()),
})

export const FullTextSearchResponseSchema = v.object({
  total: v.object({
    value: v.number(),
    relation: v.optional(v.string()),
  }),
  filings: v.array(FullTextSearchResultSchema),
})

// ─── Executive Compensation ─────────────────────────────────────────────────

export const ExecutiveCompensationSchema = v.object({
  ticker: v.optional(v.string()),
  cik: v.optional(v.string()),
  companyName: v.optional(v.string()),
  executiveName: v.optional(v.string()),
  position: v.optional(v.string()),
  reportingYear: v.optional(v.number()),
  salary: v.optional(v.number()),
  bonus: v.optional(v.number()),
  stockAwards: v.optional(v.number()),
  optionAwards: v.optional(v.number()),
  incentiveCompensation: v.optional(v.number()),
  pensionChanges: v.optional(v.number()),
  otherCompensation: v.optional(v.number()),
  totalCompensation: v.optional(v.number()),
  ceoPayRatio: optionalString,
  accessionNo: v.optional(v.string()),
  filedAt: v.optional(v.string()),
})

export const ExecutiveCompensationResponseSchema = v.object({
  total: v.optional(
    v.object({
      value: v.number(),
      relation: v.optional(v.string()),
    }),
  ),
  data: v.array(ExecutiveCompensationSchema),
})

// ─── Directors & Board Members ──────────────────────────────────────────────

export const DirectorSchema = v.object({
  ticker: v.optional(v.string()),
  cik: v.optional(v.string()),
  companyName: v.optional(v.string()),
  name: v.optional(v.string()),
  position: v.optional(v.string()),
  age: optionalNumber,
  directorClass: optionalString,
  dateFirstElected: optionalString,
  isIndependent: v.optional(v.boolean()),
  committeeMemberships: v.optional(v.array(v.string())),
  qualificationsAndExperience: v.optional(v.array(v.string())),
  accessionNo: v.optional(v.string()),
  filedAt: v.optional(v.string()),
})

export const DirectorsResponseSchema = v.object({
  total: v.optional(
    v.object({
      value: v.number(),
      relation: v.optional(v.string()),
    }),
  ),
  data: v.array(DirectorSchema),
})

// ─── Insider Trading ────────────────────────────────────────────────────────

export const InsiderTransactionSchema = v.object({
  transactionDate: v.optional(v.string()),
  transactionCode: v.optional(v.string()),
  transactionDescription: v.optional(v.string()),
  sharesTraded: v.optional(v.number()),
  pricePerShare: optionalNumber,
  sharesOwnedAfter: v.optional(v.number()),
  directOrIndirect: v.optional(v.string()),
  securityTitle: v.optional(v.string()),
})

export const InsiderTradeSchema = v.object({
  id: v.optional(v.string()),
  accessionNo: v.optional(v.string()),
  formType: v.optional(v.string()),
  filedAt: v.optional(v.string()),
  issuer: v.optional(
    v.object({
      cik: v.optional(v.string()),
      name: v.optional(v.string()),
      tradingSymbol: v.optional(v.string()),
    }),
  ),
  reportingOwner: v.optional(
    v.object({
      cik: v.optional(v.string()),
      name: v.optional(v.string()),
      isDirector: v.optional(v.boolean()),
      isOfficer: v.optional(v.boolean()),
      officerTitle: v.optional(v.string()),
      isTenPercentOwner: v.optional(v.boolean()),
    }),
  ),
  nonDerivativeTable: v.optional(
    v.nullable(
      v.object({
        transactions: v.optional(v.array(InsiderTransactionSchema)),
      }),
    ),
  ),
  derivativeTable: v.optional(
    v.nullable(
      v.object({
        transactions: v.optional(v.array(InsiderTransactionSchema)),
      }),
    ),
  ),
  periodOfReport: v.optional(v.string()),
})

export const InsiderTradingResponseSchema = v.object({
  total: v.optional(
    v.object({
      value: v.number(),
      relation: v.optional(v.string()),
    }),
  ),
  data: v.array(InsiderTradeSchema),
})

// ─── Form 8-K Structured Data ───────────────────────────────────────────────

export const Form8KItem401Schema = v.object({
  newAccountantName: optionalString,
  formerAccountantName: optionalString,
  engagementEndReason: optionalString,
  goingConcern: optionalBoolean,
  reportedIcfrWeakness: optionalBoolean,
  opinionType: optionalString,
})

export const Form8KItem402Schema = v.object({
  restatementIsNecessary: optionalBoolean,
  reasonsForRestatement: optionalString,
  impactIsMaterial: optionalBoolean,
  materialWeaknessIdentified: optionalBoolean,
  affectedReportingPeriods: v.optional(v.array(v.string())),
  keyComponents: v.optional(v.array(v.string())),
  identifiedIssues: v.optional(v.array(v.string())),
})

export const Form8KItem502Schema = v.object({
  personnelChanges: v.optional(
    v.array(
      v.object({
        personName: v.optional(v.string()),
        changeType: v.optional(v.string()),
        position: v.optional(v.string()),
        effectiveDate: optionalString,
      }),
    ),
  ),
  bonusPlans: v.optional(v.array(v.unknown())),
  organizationChanges: v.optional(v.array(v.unknown())),
})

export const Form8KFilingSchema = v.object({
  id: v.optional(v.string()),
  accessionNo: v.optional(v.string()),
  cik: v.optional(v.string()),
  ticker: v.optional(v.string()),
  companyName: v.optional(v.string()),
  formType: v.optional(v.string()),
  filedAt: v.optional(v.string()),
  items: v.optional(
    v.object({
      item401: v.optional(Form8KItem401Schema),
      item402: v.optional(Form8KItem402Schema),
      item502: v.optional(Form8KItem502Schema),
    }),
  ),
})

export const Form8KResponseSchema = v.object({
  total: v.optional(
    v.object({
      value: v.number(),
      relation: v.optional(v.string()),
    }),
  ),
  data: v.array(Form8KFilingSchema),
})

// ─── Data Mapping ───────────────────────────────────────────────────────────

export const CompanyMappingSchema = v.object({
  name: v.string(),
  ticker: v.optional(v.string()),
  cik: v.optional(v.string()),
  cusip: v.optional(v.string()),
  exchange: v.optional(v.string()),
  isDelisted: v.optional(v.boolean()),
  category: v.optional(v.string()),
  sector: v.optional(v.string()),
  industry: v.optional(v.string()),
  sic: v.optional(v.string()),
  currency: v.optional(v.string()),
  location: v.optional(v.string()),
})

export const CompanyMappingArraySchema = v.array(CompanyMappingSchema)
