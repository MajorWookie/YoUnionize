import * as v from 'valibot'

export const InsertExecutiveCompensationSchema = v.object({
  companyId: v.pipe(v.string(), v.uuid()),
  filingSummaryId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  fiscalYear: v.pipe(v.number(), v.integer()),
  executiveName: v.pipe(v.string(), v.minLength(1)),
  title: v.pipe(v.string(), v.minLength(1)),
  totalCompensation: v.pipe(v.number(), v.integer()),
  salary: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  bonus: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  stockAwards: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  optionAwards: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  nonEquityIncentive: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  otherCompensation: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  ceoPayRatio: v.optional(v.nullable(v.string())),
})

export type InsertExecutiveCompensation = v.InferOutput<typeof InsertExecutiveCompensationSchema>
