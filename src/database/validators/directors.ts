import * as v from 'valibot'

export const InsertDirectorSchema = v.object({
  companyId: v.pipe(v.string(), v.uuid()),
  name: v.pipe(v.string(), v.minLength(1)),
  title: v.pipe(v.string(), v.minLength(1)),
  isIndependent: v.optional(v.nullable(v.boolean())),
  committees: v.optional(v.nullable(v.array(v.string()))),
  tenureStart: v.optional(v.nullable(v.string())),
  age: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  directorClass: v.optional(v.nullable(v.string())),
  qualifications: v.optional(v.nullable(v.array(v.string()))),
  role: v.optional(v.nullable(v.picklist(['director', 'officer', 'both']))),
})

export type InsertDirector = v.InferOutput<typeof InsertDirectorSchema>
