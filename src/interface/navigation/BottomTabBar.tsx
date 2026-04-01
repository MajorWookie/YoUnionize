/**
 * Bottom tab bar for web — fixed at bottom on mobile viewports,
 * hidden on larger screens where we use a sidebar or top nav.
 */
import { Link, usePathname } from 'expo-router'
import { XStack, YStack, Paragraph, isWeb } from 'tamagui'
import { DiscoverIcon, MyCompanyIcon, MyPayIcon, ProfileIcon } from '../icons/TabIcons'

// Cast needed: Tamagui RC rejects 'fixed' position + position shorthand combo (TS2322 RC bug).
const FixedXStack = XStack as any

interface TabRoute {
  name: string
  label: string
  href: string
  Icon: typeof DiscoverIcon
}

const routes: Array<TabRoute> = [
  { name: 'discover', label: 'Discover', href: '/discover', Icon: DiscoverIcon },
  { name: 'my-company', label: 'My Company', href: '/my-company', Icon: MyCompanyIcon },
  { name: 'my-pay', label: 'My Pay', href: '/my-pay', Icon: MyPayIcon },
  { name: 'profile', label: 'Profile', href: '/profile', Icon: ProfileIcon },
]

export function BottomTabBar() {
  const pathname = usePathname()

  if (!isWeb) return null

  const currentTab =
    routes.find((r) => pathname.startsWith(r.href))?.name ?? 'discover'

  return (
    <FixedXStack
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      height={64}
      bg="$background"
      borderTopWidth={1}
      borderTopColor="$borderColor"
      justify="space-around"
      items="center"
      z={1000}
      $gtMd={{ display: 'none' }}
    >
      {routes.map((route) => {
        const active = currentTab === route.name
        return (
          <Link key={route.name} href={route.href as never} style={{ flex: 1 }}>
            <YStack items="center" justify="center" gap="$1" flex={1} py="$2">
              <route.Icon
                size={22}
                color={active ? 'var(--color9)' : 'var(--color7)'}
                weight={active ? 'fill' : 'regular'}
              />
              <Paragraph
                fontSize={11}
                fontWeight={active ? '600' : '400'}
                color={active ? '$color9' : '$color7'}
              >
                {route.label}
              </Paragraph>
            </YStack>
          </Link>
        )
      })}
    </FixedXStack>
  )
}
