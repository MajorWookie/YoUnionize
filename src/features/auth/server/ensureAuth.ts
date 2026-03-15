import { auth } from './auth'
import { unauthorized } from '~/server/api-utils'

export async function ensureAuth(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    throw unauthorized()
  }

  return session
}
