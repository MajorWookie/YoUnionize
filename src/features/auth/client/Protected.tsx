import { Redirect } from 'expo-router'
import type { ReactNode } from 'react'
import { Spinner, YStack } from 'tamagui'
import { useAuth } from '@union/hooks'

export function Protected({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <YStack flex={1} items="center" justify="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!user) {
    return <Redirect href="/sign-in" />
  }

  return <>{children}</>
}
