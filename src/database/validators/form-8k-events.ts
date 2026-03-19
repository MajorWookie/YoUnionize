import * as v from 'valibot'

export const InsertForm8kEventSchema = v.object({
  companyId: v.pipe(v.string(), v.uuid()),
  filingSummaryId: v.optional(v.nullable(v.pipe(v.string(), v.uuid()))),
  accessionNumber: v.pipe(v.string(), v.minLength(1)),
  filedAt: v.pipe(v.string(), v.minLength(1)),
  itemType: v.pipe(v.string(), v.minLength(1)),
  eventData: v.unknown(),
})

export type InsertForm8kEvent = v.InferOutput<typeof InsertForm8kEventSchema>
