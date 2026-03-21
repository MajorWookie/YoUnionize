import { createClient } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface AuthSession {
  user: AuthUser
}

/**
 * Verify the request's auth token and return the user session.
 * Throws a Response (401) if unauthenticated.
 */
export async function ensureAuth(request: Request): Promise<AuthSession> {
  const url = Deno.env.get('SUPABASE_URL')
  // Prefer new publishable key name; fall back to legacy anon key (auto-injected by Supabase runtime)
  const key = Deno.env.get('SUPABASE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set')
  }

  const authHeader = request.headers.get('authorization')
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined

  if (!accessToken) {
    throw new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    throw new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? '',
      name: (data.user.user_metadata?.name as string) ?? '',
    },
  }
}
