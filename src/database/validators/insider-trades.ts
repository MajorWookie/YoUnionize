import * as v from 'valibot'

const transactionTypes = ['purchase', 'sale', 'grant', 'exercise', 'gift', 'other'] as const

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
})

export type InsertInsiderTrade = v.InferOutput<typeof InsertInsiderTradeSchema>
