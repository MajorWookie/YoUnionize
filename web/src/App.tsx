import { lazy, Suspense } from 'react'
import { Center, Loader, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SupabaseClientProvider } from '@younionize/hooks'
import { configureApiClient } from '@younionize/api-client'
import { supabase } from '~/lib/supabase'
import { theme } from '~/theme'
import { Layout } from '~/components/Layout'
import { AuthLayout } from '~/components/AuthLayout'
import { AuthGuard } from '~/components/AuthGuard'
import { HomePage } from '~/routes/home'
import { SignInPage } from '~/routes/sign-in'
import { SignUpPage } from '~/routes/sign-up'

// Data-heavy routes are code-split — landing + auth pages stay eager since
// they're the first paint and tiny respectively.
const DiscoverPage = lazy(() =>
  import('~/routes/discover').then((m) => ({ default: m.DiscoverPage })),
)
const CompanyPage = lazy(() =>
  import('~/routes/company').then((m) => ({ default: m.CompanyPage })),
)
const OnboardingPage = lazy(() =>
  import('~/routes/onboarding').then((m) => ({ default: m.OnboardingPage })),
)
const ExecutivePage = lazy(() =>
  import('~/routes/executive').then((m) => ({ default: m.ExecutivePage })),
)
const ProfilePage = lazy(() =>
  import('~/routes/profile').then((m) => ({ default: m.ProfilePage })),
)
const MyPayPage = lazy(() =>
  import('~/routes/my-pay').then((m) => ({ default: m.MyPayPage })),
)
const MyCompanyPage = lazy(() =>
  import('~/routes/my-company').then((m) => ({ default: m.MyCompanyPage })),
)

configureApiClient({
  getSession: async () => {
    const { data } = await supabase.auth.getSession()
    return data.session
  },
})

function RouteFallback() {
  return (
    <Center mih="60vh">
      <Loader />
    </Center>
  )
}

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications />
      <SupabaseClientProvider client={supabase}>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route
                  path="/discover"
                  element={
                    <AuthGuard>
                      <DiscoverPage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/companies/:ticker"
                  element={
                    <AuthGuard>
                      <CompanyPage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/companies/:ticker/executive/:id"
                  element={
                    <AuthGuard>
                      <ExecutivePage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/onboarding"
                  element={
                    <AuthGuard>
                      <OnboardingPage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <AuthGuard>
                      <ProfilePage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/my-pay"
                  element={
                    <AuthGuard>
                      <MyPayPage />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/my-company"
                  element={
                    <AuthGuard>
                      <MyCompanyPage />
                    </AuthGuard>
                  }
                />
              </Route>
              <Route element={<AuthLayout />}>
                <Route path="/sign-in" element={<SignInPage />} />
                <Route path="/sign-up" element={<SignUpPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SupabaseClientProvider>
    </MantineProvider>
  )
}
