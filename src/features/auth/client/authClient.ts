import { createBrowserClient } from '@supabase/ssr'

const getSupabaseConfig = () => {
  // Expo convention: EXPO_PUBLIC_ prefix for client-side env vars
  // Falls back to legacy VITE_ convention during migration, then localhost for dev
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL
    ?? process.env.VITE_SUPABASE_URL
    ?? 'http://127.0.0.1:54321'

  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.VITE_SUPABASE_ANON_KEY
    ?? ''

  return { url, anonKey }
}

let client: ReturnType<typeof createBrowserClient> | undefined

export function getSupabaseBrowserClient() {
  if (client) return client

  const { url, anonKey } = getSupabaseConfig()
  client = createBrowserClient(url, anonKey)
  return client
}
