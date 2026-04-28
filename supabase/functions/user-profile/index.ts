import { eq } from 'drizzle-orm'
import * as v from 'valibot'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { ensureAuth } from '../_shared/auth.ts'
import { getDb } from '../_shared/db.ts'
import { userProfiles } from '../_shared/schema.ts'
import { validationError, classifyError } from '../_shared/api-utils.ts'

const UpdateProfileSchema = v.object({
  jobTitle: v.optional(v.nullable(v.string())),
  orgLevelCode: v.optional(v.nullable(v.string())),
  grossAnnualPay: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
  companyTicker: v.optional(v.nullable(v.string())),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    const session = await ensureAuth(req)
    const userId = session.user.id
    const body = await req.json()

    const parsed = v.safeParse(UpdateProfileSchema, body)
    if (!parsed.success) {
      const issues = parsed.issues.map((i) => i.message)
      return validationError('Validation failed', issues)
    }

    const db = getDb()

    const [existing] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)

    let profile
    if (existing) {
      ;[profile] = await db
        .update(userProfiles)
        .set({ ...parsed.output, updatedAt: new Date().toISOString() })
        .where(eq(userProfiles.userId, userId))
        .returning()
    } else {
      ;[profile] = await db
        .insert(userProfiles)
        .values({ userId, ...parsed.output })
        .returning()
    }

    return jsonResponse({ profile })
  } catch (err) {
    return classifyError(err)
  }
})
