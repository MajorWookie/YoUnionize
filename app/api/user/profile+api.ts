import { eq } from 'drizzle-orm'
import * as v from 'valibot'
import { getDb, userProfiles } from '@union/postgres'
import { ensureAuth } from '~/features/auth/server/ensureAuth'
import { withLogging, validationError, classifyError } from '~/server/api-utils'

const UpdateProfileSchema = v.object({
  jobTitle: v.optional(v.nullable(v.string())),
  orgLevelCode: v.optional(v.nullable(v.string())),
  grossAnnualPay: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  companyTicker: v.optional(v.nullable(v.string())),
})

const handlers = withLogging('/api/user/profile', {
  async PUT(request: Request) {
    try {
      const session = await ensureAuth(request)
      const userId = session.user.id
      const body = await request.json()

      const parsed = v.safeParse(UpdateProfileSchema, body)
      if (!parsed.success) {
        const issues = parsed.issues.map((i) => i.message)
        return validationError('Validation failed', issues)
      }

      const db = getDb()

      // Upsert: the profile row should already exist (created on signup),
      // but handle the case where it doesn't
      const [existing] = await db
        .select({ id: userProfiles.id })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1)

      let profile
      if (existing) {
        ;[profile] = await db
          .update(userProfiles)
          .set({
            ...parsed.output,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(userProfiles.userId, userId))
          .returning()
      } else {
        ;[profile] = await db
          .insert(userProfiles)
          .values({
            userId,
            ...parsed.output,
          })
          .returning()
      }

      return Response.json({ profile })
    } catch (err) {
      return classifyError(err)
    }
  },
})

export const PUT = handlers.PUT
