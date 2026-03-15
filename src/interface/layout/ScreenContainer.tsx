import type { ReactNode } from 'react'
import { ScrollView, YStack, isWeb } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ScreenContainerProps {
  children: ReactNode
  /** Disable scroll (e.g. for screens with their own list) */
  scroll?: boolean
  /** Add horizontal padding (default true) */
  padded?: boolean
}

export function ScreenContainer({
  children,
  scroll = true,
  padded = true,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets()

  const content = (
    <YStack
      flex={1}
      width="100%"
      maxWidth={isWeb ? 960 : undefined}
      alignSelf="center"
      paddingHorizontal={padded ? '$4' : undefined}
      paddingTop={isWeb ? '$4' : insets.top + 8}
      paddingBottom={isWeb ? '$4' : insets.bottom + 8}
    >
      {children}
    </YStack>
  )

  if (!scroll) return content

  return (
    <ScrollView
      flex={1}
      backgroundColor="$background"
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  )
}
