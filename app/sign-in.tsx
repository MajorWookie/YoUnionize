import { useState } from 'react'
import { useRouter } from 'expo-router'
import { Button, H2, Input, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { useAuth } from '@union/hooks'

export default function SignInPage() {
  const router = useRouter()
  const { signIn, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSignIn = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const { error: signInError } = await signIn(email, password)
      if (signInError) {
        setError(signInError.message ?? 'Sign in failed')
      } else {
        router.replace('/discover')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || isLoading

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$4" gap="$4">
      <YStack width="100%" maxWidth={400} gap="$3">
        <H2 textAlign="center">Sign In</H2>

        {error ? (
          <Paragraph color="$red10" textAlign="center">
            {error}
          </Paragraph>
        ) : null}

        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          disabled={busy}
        />

        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          disabled={busy}
        />

        <Button
          onPress={handleSignIn}
          disabled={busy || !email || !password}
          theme="active"
        >
          {busy ? <Spinner size="small" /> : 'Sign In'}
        </Button>

        <XStack justifyContent="center" gap="$2">
          <Paragraph>Don&apos;t have an account?</Paragraph>
          <Paragraph
            color="$blue10"
            cursor="pointer"
            onPress={() => router.push('/sign-up')}
          >
            Sign Up
          </Paragraph>
        </XStack>
      </YStack>
    </YStack>
  )
}
