import { createClient } from '@supabase/supabase-js'

const url =
  import.meta.env.VITE_SUPABASE_URL ??
  import.meta.env.EXPO_PUBLIC_SUPABASE_URL
const key =
  import.meta.env.VITE_SUPABASE_KEY ??
  import.meta.env.EXPO_PUBLIC_SUPABASE_KEY ??
  ''

if (!url) {
  throw new Error(
    'Supabase URL is missing. Set VITE_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL in the repo-root .env file.',
  )
}
if (!key) {
  throw new Error(
    'Supabase key is missing. Set VITE_SUPABASE_KEY or EXPO_PUBLIC_SUPABASE_KEY in the repo-root .env file.',
  )
}

export const supabase = createClient(url, key, {
  auth: {
    storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
