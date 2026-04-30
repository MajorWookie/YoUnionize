/**
 * API base URL configuration.
 *
 * Maps relative API routes (/api/*) to Supabase Edge Function URLs
 * (/functions/v1/*) and resolves the gateway apikey header from
 * EXPO_PUBLIC_* (Expo) or VITE_* (Vite) env vars.
 */

// Read via globalThis so Vite cannot statically replace `process.env` with `{}`
// at bundle time. The browser env-shim populates globalThis.process.env from
// import.meta.env before this code runs.
function readEnv(): Record<string, string | undefined> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env ?? {}
}

function getSupabaseUrl(): string {
  const env = readEnv()
  const url =
    env.EXPO_PUBLIC_SUPABASE_URL ??
    env.VITE_SUPABASE_URL ??
    env.SUPABASE_URL
  if (!url) {
    throw new Error(
      'Supabase URL is missing. Set VITE_SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) in your .env.',
    )
  }
  return url
}

function getSupabaseKey(): string {
  const env = readEnv()
  return (
    env.EXPO_PUBLIC_SUPABASE_KEY ??
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    env.VITE_SUPABASE_KEY ??
    env.VITE_SUPABASE_ANON_KEY ??
    ''
  )
}

/**
 * Returns default headers required by the Supabase API gateway.
 * The gateway requires the `apikey` header on every request,
 * even for Edge Functions that don't perform auth checks internally.
 *
 * Note: Only sets `apikey`, NOT `Authorization`. The new publishable keys
 * (sb_publishable_*) are opaque — not JWTs — and cannot be used in
 * the Authorization header. For authenticated requests, the user's
 * session JWT is injected separately by fetchWithRetry().
 */
export function getDefaultHeaders(): Record<string, string> {
  const key = getSupabaseKey()
  if (!key) return {}
  return {
    apikey: key,
  }
}

/**
 * Route mapping from relative /api/* paths to Edge Function names.
 * The Edge Function URL pattern is: {SUPABASE_URL}/functions/v1/{function-name}
 *
 * Dynamic segments (e.g. [ticker], [jobId]) become query parameters:
 *   /api/companies/AAPL/detail → /functions/v1/company-detail?ticker=AAPL
 */
const ROUTE_MAP: Record<string, string> = {
  '/api/health': 'health',
  '/api/user/me': 'user-me',
  '/api/user/profile': 'user-profile',
  '/api/user/cost-of-living': 'user-cost-of-living',
  '/api/companies/search': 'companies-search',
  '/api/companies/search-sec': 'companies-search-sec',
  '/api/companies/lookup': 'companies-lookup',
  '/api/analysis/compensation-fairness': 'compensation-fairness',
  '/api/ask': 'ask',
}

/** Dynamic route patterns that extract path params as query params. */
const DYNAMIC_ROUTES: Array<{
  pattern: RegExp
  functionName: string
  paramName: string
}> = [
  { pattern: /^\/api\/companies\/([^/]+)\/detail$/, functionName: 'company-detail', paramName: 'ticker' },
  { pattern: /^\/api\/companies\/([^/]+)\/summarize$/, functionName: 'company-summarize', paramName: 'ticker' },
  { pattern: /^\/api\/companies\/([^/]+)\/summary-status$/, functionName: 'company-summary-status', paramName: 'ticker' },
  { pattern: /^\/api\/jobs\/([^/]+)$/, functionName: 'job-status', paramName: 'id' },
]

/**
 * Convert an /api/* URL to the Supabase Edge Function URL.
 *
 * Examples:
 *   apiUrl('/api/user/me') → '{SUPABASE_URL}/functions/v1/user-me'
 *   apiUrl('/api/companies/search?q=AAPL') → '.../functions/v1/companies-search?q=AAPL'
 *   apiUrl('/api/companies/AAPL/detail') → '.../functions/v1/company-detail?ticker=AAPL'
 */
export function apiUrl(path: string): string {
  const base = getSupabaseUrl()

  const [pathname, queryString] = path.split('?')
  const existingParams = queryString ? `?${queryString}` : ''

  const staticFn = ROUTE_MAP[pathname]
  if (staticFn) {
    return `${base}/functions/v1/${staticFn}${existingParams}`
  }

  for (const route of DYNAMIC_ROUTES) {
    const match = pathname.match(route.pattern)
    if (match) {
      const paramValue = match[1]
      const separator = existingParams ? '&' : '?'
      return `${base}/functions/v1/${route.functionName}${existingParams}${separator}${route.paramName}=${encodeURIComponent(paramValue)}`
    }
  }

  return path
}
