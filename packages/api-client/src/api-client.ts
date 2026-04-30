/**
 * Client-side fetch utilities with retry logic and standardized error extraction.
 *
 * Decoupled from any specific Supabase client implementation: callers register
 * a session-getter once at app boot via configureApiClient(), and that getter
 * is invoked to attach the user's JWT to /api/* requests.
 */

import type { Session } from '@supabase/supabase-js'
import { apiUrl, getDefaultHeaders } from './api-base'

interface ApiErrorShape {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

type SessionGetter = () => Promise<Session | null>

let sessionGetter: SessionGetter = async () => null

/**
 * Register the session-getter used to attach Authorization headers to /api/* calls.
 * Call once at app boot before any fetch fires. Subsequent calls replace the getter.
 */
export function configureApiClient(opts: { getSession: SessionGetter }): void {
  sessionGetter = opts.getSession
}

/**
 * Extract user-facing message from API error responses.
 * Handles the new `{ error: { code, message } }` format, the legacy
 * `{ error: string }` format, and a raw string fallback (used when an
 * upstream like a CDN returns an HTML error page that apiFetch couldn't
 * parse as JSON).
 */
export function extractErrorMessage(data: unknown): string {
  if (typeof data === 'string') {
    const trimmed = data.trim()
    if (trimmed.length === 0) return 'Something went wrong'
    // Truncate so a multi-KB HTML body doesn't end up in a toast.
    return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (obj.error && typeof obj.error === 'object') {
      return (obj.error as ApiErrorShape['error']).message ?? 'Something went wrong'
    }
    if (typeof obj.error === 'string') {
      return obj.error
    }
  }
  return 'Something went wrong'
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const session = await sessionGetter()
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` }
    }
  } catch {
    // Session not available (e.g. not yet initialized)
  }
  return {}
}

/**
 * Fetch with automatic retry on network errors and 5xx responses.
 * Does NOT retry on 4xx (client errors).
 *
 * Automatically routes /api/* paths to Supabase Edge Functions.
 * Injects the Supabase publishable key (apikey header) and the user's
 * session JWT (Authorization header) when available.
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  const isApiRoute = url.startsWith('/api/')
  const resolvedUrl = isApiRoute ? apiUrl(url) : url

  let mergedOptions = options
  if (isApiRoute) {
    const authHeaders = await getAuthHeaders()
    mergedOptions = {
      ...options,
      headers: {
        ...getDefaultHeaders(),
        ...authHeaders,
        ...options?.headers,
      },
    }
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(resolvedUrl, mergedOptions)

      if (res.status >= 400 && res.status < 500) {
        return res
      }

      if (res.status >= 500 && attempt < maxRetries) {
        await sleep(500 * (attempt + 1))
        continue
      }

      return res
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt < maxRetries) {
        await sleep(500 * (attempt + 1))
        continue
      }
    }
  }

  throw lastError ?? new Error('Network request failed')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Convenience: fetch JSON with retry, parse response, extract error if needed.
 * Throws on network failure. Returns { ok, data, status } on any HTTP response.
 *
 * Automatically routes /api/* paths to Supabase Edge Functions.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<{ ok: boolean; data: T; status: number }> {
  const res = await fetchWithRetry(url, options)
  // Read the body once as text so a non-JSON response (e.g. HTML 502 from
  // a CDN) doesn't blow up the JSON.parse and leave the body unreadable.
  // Caller can pass the resulting string into extractErrorMessage().
  const text = await res.text()
  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    data = text as unknown as T
  }
  return { ok: res.ok, data, status: res.status }
}
