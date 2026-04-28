import { eq } from 'drizzle-orm'
import * as v from 'valibot'
import { getDb, userCostOfLiving } from '@younionize/postgres'
import { ensureAuth } from '~/features/auth/server/ensureAuth'
import { withLogging, validationError, classifyError } from '~/server/api-utils'

const cents = () => v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))))

const UpdateCostOfLivingSchema = v.object({
  rentMortgage: cents(),
  internet: cents(),
  mobilePhone: cents(),
  utilities: cents(),
  studentLoans: cents(),
  consumerDebt: cents(),
  carLoan: cents(),
  groceries: cents(),
  gym: cents(),
  entertainment: cents(),
  clothing: cents(),
  savingsTarget: cents(),
  other: cents(),
})

const handlers = withLogging('/api/user/cost-of-living', {
  async PUT(request: Request) {
    try {
      const session = await ensureAuth(request)
      const userId = session.user.id
      const body = await request.json()

      const parsed = v.safeParse(UpdateCostOfLivingSchema, body)
      if (!parsed.success) {
        const issues = parsed.issues.map((i) => i.message)
        return validationError('Validation failed', issues)
      }

      const db = getDb()

      const [existing] = await db
        .select({ id: userCostOfLiving.id })
        .from(userCostOfLiving)
        .where(eq(userCostOfLiving.userId, userId))
        .limit(1)

      let record
      if (existing) {
        ;[record] = await db
          .update(userCostOfLiving)
          .set({
            ...parsed.output,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(userCostOfLiving.userId, userId))
          .returning()
      } else {
        ;[record] = await db
          .insert(userCostOfLiving)
          .values({
            userId,
            ...parsed.output,
          })
          .returning()
      }

      return Response.json({ costOfLiving: record })
    } catch (err) {
      return classifyError(err)
    }
  },
})

export const PUT = handlers.PUT
