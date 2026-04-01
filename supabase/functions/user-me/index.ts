import { eq } from 'drizzle-orm'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { ensureAuth } from '../_shared/auth.ts'
import { getDb } from '../_shared/db.ts'
import { userProfiles, userCostOfLiving } from '../_shared/schema.ts'
import { classifyError } from '../_shared/api-utils.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    const session = await ensureAuth(req)
    const userId = session.user.id
    const db = getDb()

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)

    const [costOfLiving] = await db
      .select()
      .from(userCostOfLiving)
      .where(eq(userCostOfLiving.userId, userId))
      .limit(1)

    return jsonResponse({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      profile: profile ?? null,
      costOfLiving: costOfLiving ?? null,
    })
  } catch (err) {
    return classifyError(err)
  }
})
