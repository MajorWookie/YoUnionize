import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SupabaseClientProvider } from '@younionize/hooks'
import { configureApiClient } from '@younionize/api-client'
import { supabase } from '~/lib/supabase'
import { theme } from '~/theme'
import { Layout } from '~/components/Layout'
import { AuthLayout } from '~/components/AuthLayout'
import { HomePage } from '~/routes/home'
import { SignInPage } from '~/routes/sign-in'
import { SignUpPage } from '~/routes/sign-up'

configureApiClient({
  getSession: async () => {
    const { data } = await supabase.auth.getSession()
    return data.session
  },
})

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications />
      <SupabaseClientProvider client={supabase}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
            </Route>
            <Route element={<AuthLayout />}>
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/sign-up" element={<SignUpPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SupabaseClientProvider>
    </MantineProvider>
  )
}
