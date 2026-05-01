import {
  Anchor,
  AppShell,
  Avatar,
  Burger,
  Button,
  Group,
  Menu,
  NavLink,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconBuilding,
  IconCash,
  IconCompass,
  IconLogout,
  IconUser,
} from '@tabler/icons-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@younionize/hooks'
import classes from './Layout.module.css'

const NAV_GROUPS = [
  {
    label: 'Explore',
    items: [
      { to: '/discover', label: 'Discover', icon: IconCompass },
      { to: '/my-company', label: 'My Company', icon: IconBuilding },
      { to: '/my-pay', label: 'My Pay', icon: IconCash },
    ],
  },
  {
    label: 'Account',
    items: [{ to: '/profile', label: 'Profile', icon: IconUser }],
  },
] as const

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || ''
  if (!source) return '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0]! + parts[1][0]!).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

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
        width: 260,
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
            <Anchor component={Link} to="/" underline="never" className={classes.logo}>
              <span className={classes.logoYo}>Yo</span>
              <span className={classes.logoUnion}>Union</span>
              <span className={classes.logoIze}>ize</span>
            </Anchor>
          </Group>
          <Group gap="md">
            {user ? (
              <Menu position="bottom-end" shadow="md" width={220}>
                <Menu.Target>
                  <Avatar
                    color="navy"
                    radius="xl"
                    size="sm"
                    style={{ cursor: 'pointer' }}
                    aria-label="Account menu"
                  >
                    {getInitials(user.name, user.email)}
                  </Avatar>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{user.email || user.name}</Menu.Label>
                  <Menu.Item
                    leftSection={<IconUser size={14} />}
                    component={Link}
                    to="/profile"
                  >
                    Profile
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconLogout size={14} />}
                    onClick={handleSignOut}
                    color="red"
                  >
                    Sign out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
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
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className={classes.navGroup}>
            <Text className={classes.navSectionLabel}>{group.label}</Text>
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  component={Link}
                  to={item.to}
                  label={item.label}
                  leftSection={<Icon size={18} stroke={1.6} />}
                  active={
                    location.pathname === item.to ||
                    location.pathname.startsWith(`${item.to}/`)
                  }
                  onClick={closeMobile}
                  className={classes.navLink}
                />
              )
            })}
          </div>
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
