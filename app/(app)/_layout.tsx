import { Stack } from 'expo-router'
import { Protected } from '~/features/auth/client/Protected'

export default function AppLayout() {
  return (
    <Protected>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="company" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </Protected>
  )
}
