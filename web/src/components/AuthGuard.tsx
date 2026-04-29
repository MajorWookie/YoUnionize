import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Center, Loader } from '@mantine/core'
import { useAuth } from '@younionize/hooks'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    )
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  return <>{children}</>
}
