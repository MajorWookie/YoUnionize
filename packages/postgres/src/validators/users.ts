import * as v from 'valibot'

export const InsertUserSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  name: v.pipe(v.string(), v.minLength(1)),
})

export type InsertUser = v.InferOutput<typeof InsertUserSchema>

export const InsertUserProfileSchema = v.object({
  userId: v.pipe(v.string(), v.minLength(1)),
  jobTitle: v.optional(v.nullable(v.string())),
  orgLevelCode: v.optional(v.nullable(v.string())),
  grossAnnualPay: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  companyTicker: v.optional(v.nullable(v.string())),
})

export type InsertUserProfile = v.InferOutput<typeof InsertUserProfileSchema>

export const InsertUserCostOfLivingSchema = v.object({
  userId: v.pipe(v.string(), v.minLength(1)),
  rentMortgage: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  internet: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  mobilePhone: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  utilities: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  studentLoans: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  consumerDebt: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  carLoan: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  groceries: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  gym: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  entertainment: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  clothing: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  savingsTarget: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  other: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
})

export type InsertUserCostOfLiving = v.InferOutput<typeof InsertUserCostOfLivingSchema>
