/**
 * API base URL configuration.
 *
 * Maps the old One Framework relative API routes (/api/*) to
 * Supabase Edge Function URLs (/functions/v1/*).
 *
 * During migration, set USE_EDGE_FUNCTIONS=true to switch.
 * After migration is complete, this becomes the only path.
 */

function getSupabaseUrl(): string {
  // Expo convention: EXPO_PUBLIC_ prefix for client-side env vars
  // Vite convention (legacy): VITE_ prefix
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.EXPO_PUBLIC_SUPABASE_URL ??
      process.env.VITE_SUPABASE_URL ??
      'http://127.0.0.1:54321'
    )
  }
  return 'http://127.0.0.1:54321'
}

function getSupabaseAnonKey(): string {
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_ANON_KEY ??
      ''
    )
  }
  return ''
}

/**
 * Returns default headers required by the Supabase API gateway.
 * The gateway requires the `apikey` header on every request,
 * even for Edge Functions that don't perform auth checks internally.
 */
export function getDefaultHeaders(): Record<string, string> {
  const anonKey = getSupabaseAnonKey()
  if (!anonKey) return {}
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  }
}

/**
 * Route mapping from old One API paths to Edge Function names.
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
  { pattern: /^\/api\/companies\/([^/]+)\/ingest$/, functionName: 'company-ingest', paramName: 'ticker' },
  { pattern: /^\/api\/companies\/([^/]+)\/summarize$/, functionName: 'company-summarize', paramName: 'ticker' },
  { pattern: /^\/api\/companies\/([^/]+)\/summary-status$/, functionName: 'company-summary-status', paramName: 'ticker' },
  { pattern: /^\/api\/jobs\/([^/]+)$/, functionName: 'job-status', paramName: 'id' },
]

/**
 * Convert an old-style /api/* URL to the Supabase Edge Function URL.
 *
 * Examples:
 *   apiUrl('/api/user/me') → 'http://127.0.0.1:54321/functions/v1/user-me'
 *   apiUrl('/api/companies/search?q=AAPL') → '.../functions/v1/companies-search?q=AAPL'
 *   apiUrl('/api/companies/AAPL/detail') → '.../functions/v1/company-detail?ticker=AAPL'
 */
export function apiUrl(path: string): string {
  const base = getSupabaseUrl()

  // Parse the path and query string
  const [pathname, queryString] = path.split('?')
  const existingParams = queryString ? `?${queryString}` : ''

  // Check static routes first
  const staticFn = ROUTE_MAP[pathname]
  if (staticFn) {
    return `${base}/functions/v1/${staticFn}${existingParams}`
  }

  // Check dynamic routes
  for (const route of DYNAMIC_ROUTES) {
    const match = pathname.match(route.pattern)
    if (match) {
      const paramValue = match[1]
      const separator = existingParams ? '&' : '?'
      return `${base}/functions/v1/${route.functionName}${existingParams}${separator}${route.paramName}=${encodeURIComponent(paramValue)}`
    }
  }

  // Fallback: pass through unchanged (for any routes not yet migrated)
  return path
}
