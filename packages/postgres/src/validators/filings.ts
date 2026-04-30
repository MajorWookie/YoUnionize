import * as v from 'valibot'

const filingTypes = ['10-K', '10-Q', '8-K', 'DEF 14A', 'FORM 4'] as const

export const InsertFilingSummarySchema = v.object({
  companyId: v.pipe(v.string(), v.uuid()),
  filingType: v.picklist(filingTypes),
  periodEnd: v.optional(v.nullable(v.string())),
  filedAt: v.string(),
  accessionNumber: v.pipe(v.string(), v.minLength(1)),
  rawData: v.record(v.string(), v.unknown()),
  aiSummary: v.optional(v.nullable(v.record(v.string(), v.unknown()))),
  summaryVersion: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
})

export type InsertFilingSummary = v.InferOutput<typeof InsertFilingSummarySchema>
