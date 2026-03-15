import { createAuthClient } from 'better-auth/react'

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.ONE_SERVER_URL ?? 'http://localhost:8081'
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
})
