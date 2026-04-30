import {
  Anchor,
  AppShell,
  Burger,
  Button,
  Group,
  NavLink,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@younionize/hooks'

const NAV_ITEMS = [
  { to: '/discover', label: 'Discover' },
  { to: '/my-company', label: 'My Company' },
  { to: '/my-pay', label: 'My Pay' },
  { to: '/profile', label: 'Profile' },
] as const

export function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const showNavbar = !!user

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 240,
        breakpoint: 'sm',
        collapsed: {
          mobile: !mobileOpened || !showNavbar,
          desktop: !showNavbar,
        },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            {showNavbar && (
              <Burger
                opened={mobileOpened}
                onClick={toggleMobile}
                hiddenFrom="sm"
                size="sm"
                aria-label="Toggle navigation"
              />
            )}
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
          </Group>
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
      <AppShell.Navbar p="xs">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            component={Link}
            to={item.to}
            label={item.label}
            active={
              location.pathname === item.to ||
              location.pathname.startsWith(`${item.to}/`)
            }
            onClick={closeMobile}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
