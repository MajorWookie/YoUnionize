import { useRouter } from 'one'
import { useEffect, type ReactNode } from 'react'
import { Spinner, YStack } from 'tamagui'
import { useAuth } from '@union/hooks'

export function Protected({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/sign-in')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
