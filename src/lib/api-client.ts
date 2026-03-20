/**
 * Client-side fetch utilities with retry logic and standardized error extraction.
 */

import { apiUrl, getDefaultHeaders } from './api-base'

interface ApiErrorShape {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Extract user-facing message from API error responses.
 * Handles both the new `{ error: { code, message } }` format and
 * the legacy `{ error: string }` format.
 */
export function extractErrorMessage(data: unknown): string {
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

/**
 * Fetch with automatic retry on network errors and 5xx responses.
 * Does NOT retry on 4xx (client errors).
 *
 * Automatically routes /api/* paths to Supabase Edge Functions.
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  const isApiRoute = url.startsWith('/api/')
  const resolvedUrl = isApiRoute ? apiUrl(url) : url

  // Merge Supabase gateway headers for /api/* routes
  const mergedOptions = isApiRoute
    ? {
        ...options,
        headers: {
          ...getDefaultHeaders(),
          ...options?.headers,
        },
      }
    : options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(resolvedUrl, mergedOptions)

      // Don't retry client errors
      if (res.status >= 400 && res.status < 500) {
        return res
      }

      // Retry server errors
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
  const data = await res.json() as T
  return { ok: res.ok, data, status: res.status }
}
