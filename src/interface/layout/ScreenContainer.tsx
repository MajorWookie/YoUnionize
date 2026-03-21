import type { ReactNode } from 'react'
import { ScrollView } from 'react-native'
import { YStack, isWeb } from 'tamagui'
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
      style={{ flexGrow: 1 }}
      width="100%"
      maxW={isWeb ? 960 : undefined}
      self="center"
      px={padded ? '$4' : undefined}
      pt={isWeb ? '$4' : insets.top + 8}
      pb={isWeb ? '$4' : insets.bottom + 8}
    >
      {children}
    </YStack>
  )

  if (!scroll) return content

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  )
}
