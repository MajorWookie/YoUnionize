import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SupabaseClientProvider } from '@younionize/hooks'
import { configureApiClient } from '@younionize/api-client'
import { TamaguiRootProvider } from '~/tamagui/TamaguiRootProvider'
import { ErrorBoundary } from '~/interface/feedback/ErrorBoundary'
import { ToastProvider } from '~/interface/feedback/ToastProvider'
import { getSupabaseBrowserClient } from '~/features/auth/client/authClient'

const supabase = getSupabaseBrowserClient()

configureApiClient({
  getSession: async () => {
    const { data } = await supabase.auth.getSession()
    return data.session
  },
})

export default function RootLayout() {
  const scheme = useColorScheme()
  const navBg = scheme === 'dark' ? '#14161E' : '#ffffff'

  return (
    <SafeAreaProvider>
      <SupabaseClientProvider client={supabase}>
        <TamaguiRootProvider>
          <ErrorBoundary>
            <ToastProvider>
              <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: navBg } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(app)" />
                <Stack.Screen name="sign-in" />
                <Stack.Screen name="sign-up" />
              </Stack>
            </ToastProvider>
          </ErrorBoundary>
        </TamaguiRootProvider>
      </SupabaseClientProvider>
    </SafeAreaProvider>
  )
}
