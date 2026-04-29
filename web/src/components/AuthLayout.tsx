import { Anchor, Center, Container, Paper, Stack } from '@mantine/core'
import { Outlet, Link } from 'react-router-dom'

export function AuthLayout() {
  return (
    <Center mih="100vh" bg="slate.0" p="md">
      <Container size={420} w="100%">
        <Stack gap="md" align="center">
          <Anchor
            component={Link}
            to="/"
            underline="never"
            fw={700}
            size="xl"
            c="navy.6"
          >
            YoUnion
          </Anchor>
          <Paper withBorder shadow="sm" p="xl" radius="md" w="100%">
            <Outlet />
          </Paper>
        </Stack>
      </Container>
    </Center>
  )
}
