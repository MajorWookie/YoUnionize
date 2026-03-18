/**
 * Bottom tab bar for web — fixed at bottom on mobile viewports,
 * hidden on larger screens where we use a sidebar or top nav.
 */
import { Link, usePathname } from 'expo-router'
import { XStack, YStack, Paragraph, isWeb } from 'tamagui'
import { DiscoverIcon, MyCompanyIcon, MyPayIcon, ProfileIcon } from '../icons/TabIcons'

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
    <XStack
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      height={64}
      backgroundColor="$background"
      borderTopWidth={1}
      borderTopColor="$borderColor"
      justifyContent="space-around"
      alignItems="center"
      zIndex={1000}
      // Hide on large screens
      $gtMd={{ display: 'none' }}
    >
      {routes.map((route) => {
        const active = currentTab === route.name
        return (
          <Link key={route.name} href={route.href as never} style={{ flex: 1 }}>
            <YStack alignItems="center" justifyContent="center" gap="$1" flex={1} paddingVertical="$2">
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
    </XStack>
  )
}
