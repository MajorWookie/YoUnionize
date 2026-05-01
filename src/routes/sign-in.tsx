import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Button,
  Group,
  PasswordInput,
  Stack,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useAuth } from '@younionize/hooks'
import { PageHeader } from '~/components/primitives'

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
        navigate('/discover')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || isLoading

  return (
    <Stack gap="lg">
      <PageHeader
        title="Sign in"
        description="Welcome back. Sign in to pick up where you left off."
      />

      {error ? (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      ) : null}

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
          <Group justify="space-between" align="center" mt="xs">
            <Anchor
              component="button"
              type="button"
              size="sm"
              c="dimmed"
              onClick={() => {
                // Password reset flow not wired yet — surfaces in a future PR.
              }}
            >
              Forgot password?
            </Anchor>
            <Button type="submit" loading={busy}>
              Sign in
            </Button>
          </Group>
        </Stack>
      </form>

      <Group justify="center" gap={4} mt="xs">
        <Anchor component={Link} to="/sign-up" size="sm" c="dimmed">
          Need an account? Sign up
        </Anchor>
      </Group>
    </Stack>
  )
}
