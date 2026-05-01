import { useState, useEffect, useCallback } from 'react'
import { type User, type Session, type AuthError, type SupabaseClient } from '@supabase/supabase-js'
import { useSupabaseClient } from './SupabaseClientContext'

function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined
  const v = process.env[key]
  return v && v !== '' ? v : undefined
}

// Optional dev-mode auto-sign-in. When both env vars are set, useAuth signs
// in with these credentials on mount so /api/* calls have a real Supabase JWT
// without a manual /sign-in round trip. The first run against a fresh project
// auto-provisions the user via signUp. Leave both unset for normal manual auth.
const DEV_TEST_EMAIL = readEnv('EXPO_PUBLIC_DEV_TEST_EMAIL')
const DEV_TEST_PASSWORD = readEnv('EXPO_PUBLIC_DEV_TEST_PASSWORD')
const DEV_AUTO_SIGN_IN = !!DEV_TEST_EMAIL && !!DEV_TEST_PASSWORD

interface SignInResult {
  data: { user: User | null; session: Session | null } | null
  error: AuthError | null
}

interface SignUpResult {
  data: { user: User | null; session: Session | null } | null
  error: AuthError | null
}

// In-flight guard so React StrictMode (or rapid re-mounts) can't fire two
// parallel sign-in attempts for the same dev creds.
let devAutoSignInPromise: Promise<void> | null = null

async function ensureDevSession(supabase: SupabaseClient): Promise<void> {
  if (!DEV_AUTO_SIGN_IN) return
  if (devAutoSignInPromise) return devAutoSignInPromise

  devAutoSignInPromise = (async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: DEV_TEST_EMAIL!,
      password: DEV_TEST_PASSWORD!,
    })
    if (!signInError) return

    // Auto-provision the test user on first run against a fresh project.
    // Only kicks in for "Invalid login credentials" — other errors (network,
    // disabled auth, etc.) bubble up to the console.
    const isInvalidCreds = /invalid login credentials/i.test(signInError.message)
    if (!isInvalidCreds) {
      console.warn('[useAuth] Dev auto-sign-in failed:', signInError.message)
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: DEV_TEST_EMAIL!,
      password: DEV_TEST_PASSWORD!,
      options: { data: { name: 'Dev Test User' } },
    })
    if (signUpError) {
      console.warn('[useAuth] Dev auto-provision failed:', signUpError.message)
      return
    }

    const { error: retryError } = await supabase.auth.signInWithPassword({
      email: DEV_TEST_EMAIL!,
      password: DEV_TEST_PASSWORD!,
    })
    if (retryError) {
      console.warn('[useAuth] Dev sign-in after provision failed:', retryError.message)
    }
  })().finally(() => {
    devAutoSignInPromise = null
  })

  return devAutoSignInPromise
}

export function useAuth() {
  const supabase = useSupabaseClient()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      await ensureDevSession(supabase)
      if (cancelled) return

      const { data } = await supabase.auth.getSession()
      if (cancelled) return

      setSession(data.session)
      setUser(data.session?.user ?? null)
      setIsLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const result = await supabase.auth.signInWithPassword({ email, password })
      return {
        data: result.data,
        error: result.error,
      }
    },
    [supabase],
  )

  const signUp = useCallback(
    async (email: string, password: string, name: string): Promise<SignUpResult> => {
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
    [supabase],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [supabase])

  return {
    user: user
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
