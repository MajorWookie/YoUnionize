/**
 * Tabs layout — native version.
 * Uses @react-navigation/bottom-tabs with a custom tab bar.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { withLayoutContext } from 'expo-router'
import { NativeTabBar } from '~/interface/navigation/NativeTabBar'

const Tab = createBottomTabNavigator()
const Tabs = withLayoutContext(Tab.Navigator)

export default function TabsNativeLayout() {
  return (
    <Tabs
      initialRouteName="discover"
      tabBar={(props) => <NativeTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="my-company" />
      <Tabs.Screen name="my-pay" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}
