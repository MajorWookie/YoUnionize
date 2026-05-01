import { Anchor, Button, Container, Group } from '@mantine/core'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@younionize/hooks'
import classes from './Layout.module.css'

/**
 * Marketing-page shell. Header + main + (future) footer slot, no navbar,
 * centered to a comfortable max width. Wired in by PR 10 (HomePage); lives
 * here from Phase 0b so route restructure PRs only need to swap routes
 * onto it.
 */
export function PublicLayout() {
  const { user } = useAuth()

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          height: 60,
          borderBottom: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
        }}
      >
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between">
            <Anchor component={Link} to="/" underline="never" className={classes.logo}>
              <span className={classes.logoYo}>Yo</span>
              <span className={classes.logoUnion}>Union</span>
              <span className={classes.logoIze}>ize</span>
            </Anchor>
            <Group gap="md">
              {user ? (
                <Button component={Link} to="/discover" variant="subtle">
                  Open app
                </Button>
              ) : (
                <>
                  <Anchor component={Link} to="/sign-in" size="sm" c="dimmed">
                    Sign in
                  </Anchor>
                  <Button component={Link} to="/sign-up">
                    Sign up
                  </Button>
                </>
              )}
            </Group>
          </Group>
        </Container>
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  )
}
