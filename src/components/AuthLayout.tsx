import { Center, Container, Paper, Stack } from '@mantine/core'
import { Outlet } from 'react-router-dom'
import { Wordmark } from './Wordmark'

export function AuthLayout() {
  return (
    <Center mih="100vh" bg="slate.0" p="md">
      <Container size={520} w="100%">
        <Stack gap="lg" align="center">
          <Wordmark />
          <Paper withBorder p="xl" radius="md" w="100%">
            <Outlet />
          </Paper>
        </Stack>
      </Container>
    </Center>
  )
}
