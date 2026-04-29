import type { ReactNode } from 'react'
import { ScrollView } from 'react-native'
import { useTheme, YStack } from 'tamagui'
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
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const bg = theme.background?.val ?? '#fff'

  const content = (
    <YStack
      style={{ flexGrow: 1, backgroundColor: bg }}
      width="100%"
      self="center"
      px={padded ? '$4' : undefined}
      pt={insets.top + 8}
      pb={insets.bottom + 8}
    >
      {children}
    </YStack>
  )

  if (!scroll) return content

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  )
}
