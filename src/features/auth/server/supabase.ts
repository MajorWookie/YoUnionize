import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client with the service role key for server-side operations.
 * This client bypasses RLS and should only be used in trusted server contexts.
 */
export function createServerClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Create a Supabase client that reads the user's auth token from the request.
 * Used to verify the current user in API routes.
 */
export function createRequestClient(request: Request): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set')
  }

  // Extract the access token from the Authorization header or cookie
  const authHeader = request.headers.get('authorization')
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined

  // If we have a bearer token, create a client with it
  if (accessToken) {
    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  // Otherwise create a client that will read from cookies via the request
  const cookieHeader = request.headers.get('cookie') ?? ''
  return createClient(url, anonKey, {
    global: {
      headers: { cookie: cookieHeader },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
