import { Button, Container, Group, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <Container size="md" py="xl">
      <Stack gap="lg" align="center" ta="center" py="xl">
        <Title order={1} c="navy.6">
          Analyze SEC filings with AI
        </Title>
        <Text size="lg" c="slate.7" maw={560}>
          YoUnion helps you understand executive compensation, risk factors,
          and management commentary from SEC filings — and benchmark them
          against your own pay.
        </Text>
        <Group gap="md" mt="md">
          <Button size="md" component={Link} to="/sign-up">
            Get Started
          </Button>
          <Button size="md" variant="default" component={Link} to="/sign-in">
            Sign In
          </Button>
        </Group>
      </Stack>
    </Container>
  )
}
