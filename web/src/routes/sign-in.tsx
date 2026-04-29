import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Button,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useAuth } from '@younionize/hooks'

export function SignInPage() {
  const navigate = useNavigate()
  const { signIn, isLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
      password: (v) => (v.length > 0 ? null : 'Password is required'),
    },
  })

  const onSubmit = async (values: typeof form.values) => {
    setError(null)
    setSubmitting(true)
    try {
      const { error: signInError } = await signIn(values.email, values.password)
      if (signInError) {
        setError(signInError.message ?? 'Sign in failed')
      } else {
        // TODO: redirect to /discover once that route exists (Phase 2b-ii).
        navigate('/')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || isLoading

  return (
    <Stack gap="md">
      <Title order={3} ta="center">
        Sign In
      </Title>
      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Email"
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            disabled={busy}
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={busy}
            {...form.getInputProps('password')}
          />
          <Button type="submit" loading={busy} fullWidth>
            Sign In
          </Button>
        </Stack>
      </form>
      <Anchor component={Link} to="/sign-up" ta="center" size="sm">
        Need an account? Sign up
      </Anchor>
    </Stack>
  )
}
