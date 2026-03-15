/**
 * Custom native tab bar using React Navigation's BottomTabBarProps.
 */
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Pressable } from 'react-native'
import { XStack, YStack, Paragraph, useTheme } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DiscoverIcon, MyCompanyIcon, MyPayIcon, ProfileIcon } from '../icons/TabIcons'

const TAB_ICONS: Record<string, typeof DiscoverIcon> = {
  discover: DiscoverIcon,
  'my-company': MyCompanyIcon,
  'my-pay': MyPayIcon,
  profile: ProfileIcon,
}

const TAB_LABELS: Record<string, string> = {
  discover: 'Discover',
  'my-company': 'My Company',
  'my-pay': 'My Pay',
  profile: 'Profile',
}

export function NativeTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const theme = useTheme()

  return (
    <XStack
      backgroundColor="$background"
      borderTopWidth={1}
      borderTopColor="$borderColor"
      paddingBottom={insets.bottom}
      justifyContent="space-around"
      alignItems="center"
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index
        const Icon = TAB_ICONS[route.name] ?? DiscoverIcon
        const label = TAB_LABELS[route.name] ?? route.name

        const activeColor = theme.color9?.val ?? '#3a6cbb'
        const inactiveColor = theme.color7?.val ?? '#868e96'

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              })
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name)
              }
            }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}
          >
            <YStack alignItems="center" gap={2}>
              <Icon
                size={22}
                color={focused ? activeColor : inactiveColor}
                weight={focused ? 'fill' : 'regular'}
              />
              <Paragraph
                fontSize={11}
                fontWeight={focused ? '600' : '400'}
                color={focused ? '$color9' : '$color7'}
              >
                {label}
              </Paragraph>
            </YStack>
          </Pressable>
        )
      })}
    </XStack>
  )
}
