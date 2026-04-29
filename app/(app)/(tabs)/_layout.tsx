import { Tabs } from 'expo-router'
import { NativeTabBar } from '~/interface/navigation/NativeTabBar'

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="discover/index"
      tabBar={(props) => <NativeTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    />
  )
}
