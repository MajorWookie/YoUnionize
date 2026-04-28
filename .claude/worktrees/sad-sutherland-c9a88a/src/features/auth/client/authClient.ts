import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const getSupabaseConfig = () => {
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL
    ?? 'http://127.0.0.1:54321'

  const key =
    process.env.EXPO_PUBLIC_SUPABASE_KEY
    ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ?? ''

  return { url, anonKey: key }
}

let client: SupabaseClient | undefined

export function getSupabaseBrowserClient() {
  if (client) return client

  const { url, anonKey } = getSupabaseConfig()
  client = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
  return client
}
