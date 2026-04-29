import { MantineProvider } from '@mantine/core'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SupabaseClientProvider } from '@younionize/hooks'
import { configureApiClient } from '@younionize/api-client'
import { supabase } from '~/lib/supabase'
import { theme } from '~/theme'
import { HomePage } from '~/routes/home'

configureApiClient({
  getSession: async () => {
    const { data } = await supabase.auth.getSession()
    return data.session
  },
})

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <SupabaseClientProvider client={supabase}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </BrowserRouter>
      </SupabaseClientProvider>
    </MantineProvider>
  )
}
