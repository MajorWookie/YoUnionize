/**
 * Tabs layout — web version.
 * Uses Expo Router's Slot for routing + a custom BottomTabBar on small screens.
 */
import { Slot } from 'expo-router'
import { View } from 'tamagui'
import { BottomTabBar } from '~/interface/navigation/BottomTabBar'

export default function TabsWebLayout() {
  return (
    <>
      <View flex={1} paddingBottom={64} $gtMd={{ paddingBottom: 0 }}>
        <Slot />
      </View>
      <BottomTabBar />
    </>
  )
}
