import * as v from 'valibot'

export const InsertDirectorSchema = v.object({
  companyId: v.pipe(v.string(), v.uuid()),
  name: v.pipe(v.string(), v.minLength(1)),
  title: v.pipe(v.string(), v.minLength(1)),
  isIndependent: v.optional(v.nullable(v.boolean())),
  committees: v.optional(v.nullable(v.array(v.string()))),
  tenureStart: v.optional(v.nullable(v.string())),
})

export type InsertDirector = v.InferOutput<typeof InsertDirectorSchema>
