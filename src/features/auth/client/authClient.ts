import { createBrowserClient } from '@supabase/ssr'

const getSupabaseConfig = () => {
  // Vite exposes VITE_* env vars to the client via import.meta.env
  // Server-side (SSR) falls back to process.env
  const url =
    (import.meta as Record<string, Record<string, string>>).env?.VITE_SUPABASE_URL
    ?? process.env.SUPABASE_URL
    ?? 'http://127.0.0.1:54321'

  const anonKey =
    (import.meta as Record<string, Record<string, string>>).env?.VITE_SUPABASE_ANON_KEY
    ?? process.env.SUPABASE_ANON_KEY
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
