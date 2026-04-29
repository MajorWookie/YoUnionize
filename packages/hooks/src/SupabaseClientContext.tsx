import { createContext, useContext, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

const Ctx = createContext<SupabaseClient | null>(null)

export function SupabaseClientProvider({
  client,
  children,
}: {
  client: SupabaseClient
  children: ReactNode
}) {
  return <Ctx.Provider value={client}>{children}</Ctx.Provider>
}

export function useSupabaseClient(): SupabaseClient {
  const client = useContext(Ctx)
  if (!client) {
    throw new Error(
      'useSupabaseClient must be used inside <SupabaseClientProvider>',
    )
  }
  return client
}
