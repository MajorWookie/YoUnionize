import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Button,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useAuth } from '@younionize/hooks'
import { PageHeader, TrustStrip } from '~/components/primitives'

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
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || isLoading

  return (
    <Stack gap="lg">
      <PageHeader
        title="Create your account"
        description="Understand your compensation in context. Free, takes a minute."
      />

      {error ? (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      ) : null}

      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
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
              placeholder="Re-enter your password"
              autoComplete="new-password"
              disabled={busy}
              {...form.getInputProps('confirmPassword')}
            />
          </SimpleGrid>

          <TrustStrip>
            Your pay details never leave your account. We never share with
            employers.
          </TrustStrip>

          <Button type="submit" loading={busy}>
            Create account
          </Button>
        </Stack>
      </form>

      <Group justify="center" gap={4} mt="xs">
        <Anchor component={Link} to="/sign-in" size="sm" c="dimmed">
          Already have an account? Sign in
        </Anchor>
      </Group>
    </Stack>
  )
}
