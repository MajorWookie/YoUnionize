import { Slot, Stack } from 'one'
import { Protected } from '~/features/auth/client/Protected'

export function Layout() {
  return (
    <Protected>
      {process.env.VITE_NATIVE ? (
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="company" />
          <Stack.Screen name="onboarding" />
        </Stack>
      ) : (
        <Slot />
      )}
    </Protected>
  )
}
