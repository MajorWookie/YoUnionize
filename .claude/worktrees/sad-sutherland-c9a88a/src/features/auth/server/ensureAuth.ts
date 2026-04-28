import { createRequestClient } from './supabase'
import { unauthorized } from '~/server/api-utils'

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface AuthSession {
  user: AuthUser
}

export async function ensureAuth(request: Request): Promise<AuthSession> {
  const supabase = createRequestClient(request)
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    throw unauthorized()
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? '',
      name: data.user.user_metadata?.name as string ?? '',
    },
  }
}
