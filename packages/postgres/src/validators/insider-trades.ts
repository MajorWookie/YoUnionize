import * as v from 'valibot'

const transactionTypes = ['purchase', 'sale', 'grant', 'exercise', 'gift', 'holding', 'other'] as const

export const InsertInsiderTradeSchema = v.object({
  companyId: v.pipe(v.string(), v.uuid()),
  filerName: v.pipe(v.string(), v.minLength(1)),
  filerTitle: v.optional(v.nullable(v.string())),
  transactionDate: v.string(),
  transactionType: v.picklist(transactionTypes),
  shares: v.string(),
  pricePerShare: v.optional(v.nullable(v.string())),
  totalValue: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  filingUrl: v.optional(v.nullable(v.string())),
  isDerivative: v.optional(v.boolean()),
  accessionNumber: v.optional(v.nullable(v.string())),
  securityTitle: v.optional(v.nullable(v.string())),
  sharesOwnedAfter: v.optional(v.nullable(v.string())),
  transactionDescription: v.optional(v.nullable(v.string())),
  directOrIndirect: v.optional(v.nullable(v.string())),
  exerciseDate: v.optional(v.nullable(v.string())),
  expirationDate: v.optional(v.nullable(v.string())),
  conversionOrExercisePrice: v.optional(v.nullable(v.string())),
  underlyingSecurityTitle: v.optional(v.nullable(v.string())),
  underlyingSecurityShares: v.optional(v.nullable(v.string())),
  extraData: v.optional(v.nullable(v.record(v.string(), v.unknown()))),
})

export type InsertInsiderTrade = v.InferOutput<typeof InsertInsiderTradeSchema>
