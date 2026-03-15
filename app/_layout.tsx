import './root.css'

import { LoadProgressBar, Slot, Stack } from 'one'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { TamaguiRootProvider } from '~/tamagui/TamaguiRootProvider'
import { ErrorBoundary } from '~/interface/feedback/ErrorBoundary'
import { ToastProvider } from '~/interface/feedback/ToastProvider'

export function Layout() {
  return (
    <html lang="en-US">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=5.0"
        />
        <title>Union</title>
      </head>

      <body>
        <SafeAreaProvider>
          <TamaguiRootProvider>
            <ErrorBoundary>
              <ToastProvider>
                {process.env.VITE_NATIVE ? (
                  <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
                    <Stack.Screen name="(app)" />
                    <Stack.Screen name="sign-in" />
                    <Stack.Screen name="sign-up" />
                  </Stack>
                ) : (
                  <>
                    <LoadProgressBar />
                    <Slot />
                  </>
                )}
              </ToastProvider>
            </ErrorBoundary>
          </TamaguiRootProvider>
        </SafeAreaProvider>
      </body>
    </html>
  )
}
