import { useRouter, useRootNavigationState } from 'expo-router'
import { useEffect, type ReactNode } from 'react'
import { Spinner, YStack } from 'tamagui'
import { useAuth } from '@union/hooks'

export function Protected({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const rootNavState = useRootNavigationState()

  useEffect(() => {
    if (!rootNavState?.key) return
    if (!isLoading && !user) {
      router.replace('/sign-in')
    }
  }, [user, isLoading, router, rootNavState?.key])

  if (isLoading) {
    return (
      <YStack flex={1} items="center" justify="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
