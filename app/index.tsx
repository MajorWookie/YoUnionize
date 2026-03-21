import { useEffect } from 'react'
import { useRouter, useRootNavigationState } from 'expo-router'
import { Button, H1, Paragraph, Spinner, YStack } from 'tamagui'
import { useAuth } from '@union/hooks'

export default function HomePage() {
  const router = useRouter()
  const rootNavState = useRootNavigationState()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!rootNavState?.key) return
    if (!isLoading && user) {
      router.replace('/discover')
    }
  }, [user, isLoading, router, rootNavState?.key])

  if (isLoading) {
    return (
      <YStack flex={1} items="center" justify="center">
        <Spinner size="large" color="$color9" />
      </YStack>
    )
  }

  if (user) return null

  return (
    <YStack flex={1} items="center" justify="center" p="$4" gap="$4">
      <H1>YoUnion</H1>
      <Paragraph color="$color8">
        Understand your company. Know your worth.
      </Paragraph>
      <YStack gap="$3" width="100%" maxW={320}>
        <Button size="$4" theme="accent" onPress={() => router.push('/sign-in')}>
          Sign In
        </Button>
        <Button size="$4" variant="outlined" onPress={() => router.push('/sign-up')}>
          Create Account
        </Button>
      </YStack>
    </YStack>
  )
}
