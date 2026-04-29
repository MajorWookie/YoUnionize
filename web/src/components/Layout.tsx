import { Anchor, AppShell, Button, Group } from '@mantine/core'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@younionize/hooks'

export function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Anchor
            component={Link}
            to="/"
            underline="never"
            fw={700}
            size="xl"
            c="navy.6"
          >
            YoUnionize
          </Anchor>
          <Group gap="xs">
            {user ? (
              <Button variant="subtle" onClick={handleSignOut}>
                Sign Out
              </Button>
            ) : (
              <>
                <Button variant="subtle" component={Link} to="/sign-in">
                  Sign In
                </Button>
                <Button component={Link} to="/sign-up">
                  Sign Up
                </Button>
              </>
            )}
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
