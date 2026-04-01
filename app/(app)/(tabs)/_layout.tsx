/**
 * Tabs layout — web version.
 * Uses Expo Router's Slot for routing + a custom BottomTabBar on small screens.
 */
import { Slot } from 'expo-router'
import { YStack } from 'tamagui'
import { BottomTabBar } from '~/interface/navigation/BottomTabBar'

// Cast needed: Tamagui RC does not accept shorthands inside $gtMd responsive props (TS2322).
const ResponsiveYStack = YStack as any

export default function TabsWebLayout() {
  return (
    <>
      <ResponsiveYStack flex={1} pb={64} $gtMd={{ paddingBottom: 0 }}>
        <Slot />
      </ResponsiveYStack>
      <BottomTabBar />
    </>
  )
}
