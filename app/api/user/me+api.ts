import { eq } from 'drizzle-orm'
import { getDb, userProfiles, userCostOfLiving } from '@younionize/postgres'
import { ensureAuth } from '~/features/auth/server/ensureAuth'
import { withLogging, classifyError } from '~/server/api-utils'

const handlers = withLogging('/api/user/me', {
  async GET(request: Request) {
    try {
      const session = await ensureAuth(request)
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

      return Response.json({
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
  },
})

export const GET = handlers.GET
