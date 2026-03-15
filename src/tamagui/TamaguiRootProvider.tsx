import { SchemeProvider, useUserScheme } from '@vxrn/color-scheme'
import type { ReactNode } from 'react'
import { TamaguiProvider, isWeb } from 'tamagui'
import { config } from './tamagui.config'

function TamaguiInnerProvider({ children }: { children: ReactNode }) {
  const scheme = useUserScheme()

  return (
    <TamaguiProvider
      disableInjectCSS={isWeb}
      config={config}
      defaultTheme={scheme.value ?? 'light'}
    >
      {children}
    </TamaguiProvider>
  )
}

export function TamaguiRootProvider({ children }: { children: ReactNode }) {
  return (
    <SchemeProvider>
      <TamaguiInnerProvider>{children}</TamaguiInnerProvider>
    </SchemeProvider>
  )
}
