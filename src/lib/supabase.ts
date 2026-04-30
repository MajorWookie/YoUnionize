import { createClient } from '@supabase/supabase-js'

const url =
  import.meta.env.VITE_SUPABASE_URL ??
  import.meta.env.EXPO_PUBLIC_SUPABASE_URL ??
  'http://127.0.0.1:54321'
const key =
  import.meta.env.VITE_SUPABASE_KEY ??
  import.meta.env.EXPO_PUBLIC_SUPABASE_KEY ??
  ''

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
