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

export function SignUpPage() {
  const navigate = useNavigate()
  const { signUp, isLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm({
    initialValues: { name: '', email: '', password: '', confirmPassword: '' },
    validate: {
      name: (v) => (v.trim().length > 0 ? null : 'Name is required'),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
      password: (v) =>
        v.length >= 8 ? null : 'Password must be at least 8 characters',
      confirmPassword: (v, values) =>
        v === values.password ? null : 'Passwords do not match',
    },
  })

  const onSubmit = async (values: typeof form.values) => {
    setError(null)
    setSubmitting(true)
    try {
      const { error: signUpError } = await signUp(
        values.email,
        values.password,
        values.name,
      )
      if (signUpError) {
        setError(signUpError.message ?? 'Sign up failed')
      } else {
        navigate('/onboarding')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || isLoading

  return (
    <Stack gap="md">
      <Title order={3} ta="center">
        Create your account
      </Title>
      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="Jane Smith"
            autoComplete="name"
            disabled={busy}
            {...form.getInputProps('name')}
          />
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
            placeholder="At least 8 characters"
            autoComplete="new-password"
            disabled={busy}
            {...form.getInputProps('password')}
          />
          <PasswordInput
            label="Confirm password"
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={busy}
            {...form.getInputProps('confirmPassword')}
          />
          <Button type="submit" loading={busy} fullWidth>
            Sign Up
          </Button>
        </Stack>
      </form>
      <Anchor component={Link} to="/sign-in" ta="center" size="sm">
        Already have an account? Sign in
      </Anchor>
    </Stack>
  )
}
