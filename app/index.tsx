import { Redirect, useRouter } from 'expo-router'
import { Button, H1, Paragraph, Spinner, YStack } from 'tamagui'
import { useAuth } from '@younionize/hooks'

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <YStack flex={1} items="center" justify="center">
        <Spinner size="large" color="$color9" />
      </YStack>
    )
  }

  if (user) {
    return <Redirect href="/discover" />
  }

  return (
    <YStack flex={1} items="center" justify="center" p="$4" gap="$4">
      <H1>YoUnionize</H1>
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
