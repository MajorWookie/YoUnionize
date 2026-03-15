/**
 * Tabs layout — web version.
 * Uses One's Slot for routing + a custom BottomTabBar on small screens.
 */
import { Slot } from 'one'
import { View } from 'tamagui'
import { BottomTabBar } from '~/interface/navigation/BottomTabBar'

export function Layout() {
  return (
    <>
      <View flex={1} paddingBottom={64} $gtMd={{ paddingBottom: 0 }}>
        <Slot />
      </View>
      <BottomTabBar />
    </>
  )
}
