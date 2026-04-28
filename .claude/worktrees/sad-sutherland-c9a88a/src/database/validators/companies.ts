import * as v from 'valibot'

export const InsertCompanySchema = v.object({
  ticker: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  cik: v.pipe(v.string(), v.minLength(1)),
  sector: v.optional(v.nullable(v.string())),
  industry: v.optional(v.nullable(v.string())),
  exchange: v.optional(v.nullable(v.string())),
})

export type InsertCompany = v.InferOutput<typeof InsertCompanySchema>
