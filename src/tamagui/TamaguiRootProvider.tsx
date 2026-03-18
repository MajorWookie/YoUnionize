import type { ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { TamaguiProvider, isWeb } from 'tamagui'
import { config } from './tamagui.config'

export function TamaguiRootProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()

  return (
    <TamaguiProvider
      disableInjectCSS={isWeb}
      config={config}
      defaultTheme={scheme ?? 'light'}
    >
      {children}
    </TamaguiProvider>
  )
}
