import { useState } from 'react'
import { useRouter } from 'expo-router'
import { Button, H2, Input, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { useAuth } from '@union/hooks'

export default function SignUpPage() {
  const router = useRouter()
  const { signUp, isLoading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSignUp = async () => {
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)
    try {
      const { error: signUpError } = await signUp(email, password, name)
      if (signUpError) {
        setError(signUpError.message ?? 'Sign up failed')
      } else {
        router.replace('/onboarding')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      console.info('[SignUp] Error:', message)
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || isLoading
  const canSubmit = name && email && password && confirmPassword && !busy

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$4" gap="$4">
      <YStack width="100%" maxWidth={400} gap="$3">
        <H2 textAlign="center">Create Account</H2>

        {error ? (
          <Paragraph color="$red10" textAlign="center">
            {error}
          </Paragraph>
        ) : null}

        <Input
          placeholder="Full Name"
          value={name}
          onChangeText={setName}
          disabled={busy}
        />

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

        <Input
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          disabled={busy}
        />

        <Button
          onPress={handleSignUp}
          disabled={!canSubmit}
          theme="active"
        >
          {busy ? <Spinner size="small" /> : 'Create Account'}
        </Button>

        <XStack justifyContent="center" gap="$2">
          <Paragraph>Already have an account?</Paragraph>
          <Paragraph
            color="$blue10"
            cursor="pointer"
            onPress={() => router.push('/sign-in')}
          >
            Sign In
          </Paragraph>
        </XStack>
      </YStack>
    </YStack>
  )
}
