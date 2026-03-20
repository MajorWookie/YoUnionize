import { useState, useEffect, useCallback } from 'react'
import { type User, type Session, type AuthError } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '~/features/auth/client/authClient'

// TODO: Set to false (or remove) to restore real auth before production
const DEV_SKIP_AUTH = true

const DEV_TEST_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'testuser@younion.dev',
  name: 'Test User',
} as const

interface SignInResult {
  data: { user: User | null; session: Session | null } | null
  error: AuthError | null
}

interface SignUpResult {
  data: { user: User | null; session: Session | null } | null
  error: AuthError | null
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(!DEV_SKIP_AUTH)

  useEffect(() => {
    if (DEV_SKIP_AUTH) return

    const supabase = getSupabaseBrowserClient()

    // Get the initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setIsLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const supabase = getSupabaseBrowserClient()
      const result = await supabase.auth.signInWithPassword({ email, password })
      return {
        data: result.data,
        error: result.error,
      }
    },
    [],
  )

  const signUp = useCallback(
    async (email: string, password: string, name: string): Promise<SignUpResult> => {
      const supabase = getSupabaseBrowserClient()
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      })
      return {
        data: result.data,
        error: result.error,
      }
    },
    [],
  )

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
  }, [])

  return {
    user: DEV_SKIP_AUTH
      ? DEV_TEST_USER
      : user
        ? {
            id: user.id,
            email: user.email ?? '',
            name: (user.user_metadata?.name as string) ?? '',
          }
        : null,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
  }
}
