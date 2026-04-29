import { useEffect, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { TamaguiProvider, Theme } from 'tamagui'
import { config } from './tamagui.config'

// Web-only DOM shim, retained from prior in-progress work. No-ops on iOS
// (typeof document === 'undefined' returns early). Safe to delete in a future
// cleanup pass now that web is no longer a target platform.
function useDspContentsShim() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const id = 'younion-dsp-contents-shim'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = ':root ._dsp_contents { display: contents; }'
    document.head.appendChild(style)
  }, [])
}

export function TamaguiRootProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme()
  useDspContentsShim()

  return (
    <TamaguiProvider
      config={config}
      defaultTheme={scheme ?? 'light'}
    >
      <Theme name={scheme ?? 'light'}>
        {children}
      </Theme>
    </TamaguiProvider>
  )
}
