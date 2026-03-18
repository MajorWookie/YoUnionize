/**
 * Tabs layout — native version.
 * Uses Expo Router's Tabs with a custom tab bar.
 */
import { Tabs } from 'expo-router'
import { NativeTabBar } from '~/interface/navigation/NativeTabBar'

export default function TabsNativeLayout() {
  return (
    <Tabs
      initialRouteName="discover/index"
      tabBar={(props) => <NativeTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    />
  )
}
