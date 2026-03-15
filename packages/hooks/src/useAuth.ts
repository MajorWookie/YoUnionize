import { useCallback } from 'react'
import { createAuthClient } from 'better-auth/react'

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.ONE_SERVER_URL ?? 'http://localhost:8081'
}

const authClient = createAuthClient({
  baseURL: getBaseURL(),
})

export function useAuth() {
  const session = authClient.useSession()

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await authClient.signIn.email({ email, password })
      return result
    },
    [],
  )

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const result = await authClient.signUp.email({ email, password, name })
      return result
    },
    [],
  )

  const signOut = useCallback(async () => {
    await authClient.signOut()
  }, [])

  return {
    user: session.data?.user ?? null,
    session: session.data?.session ?? null,
    isLoading: session.isPending,
    signIn,
    signUp,
    signOut,
  }
}
