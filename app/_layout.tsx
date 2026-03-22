import { Stack } from 'expo-router'
import { Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { TamaguiRootProvider } from '~/tamagui/TamaguiRootProvider'
import { ErrorBoundary } from '~/interface/feedback/ErrorBoundary'
import { ToastProvider } from '~/interface/feedback/ToastProvider'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TamaguiRootProvider>
        <ErrorBoundary>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="sign-up" />
            </Stack>
          </ToastProvider>
        </ErrorBoundary>
      </TamaguiRootProvider>
    </SafeAreaProvider>
  )
}
