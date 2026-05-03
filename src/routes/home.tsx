import { Button, Container, Group, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <Container size="md" py="xl">
      <Stack gap="lg" align="center" ta="center" py="xl">
        <Title order={1} c="navy.6">
          Follow the Money
        </Title>
        <Text size="lg" c="slate.7" maw={560}>
          YoUnionize.me helps you understand your company's business, management commentary, risk factors, and executive compensation — straight from their own SEC filings — then benchmark them against your own and your colleagues' experience and pay
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
