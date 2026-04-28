// HTTP client for the review Edge Functions.
//
// Thin fetch() wrapper that attaches the Supabase auth token + publishable
// key, parses JSON, and surfaces structured errors. The CLI commands talk
// to Edge Functions over HTTP (not direct DB) so the same code path will
// be exercised by the future UI.

import { type CliConfig, getActiveSession, loadCliConfig } from './auth'
import type { ReviewLogger } from './logger'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface CallOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT'
  query?: Record<string, string | number | undefined>
  body?: unknown
  logger?: ReviewLogger
  scope?: string
}

export class ReviewApiClient {
  private constructor(
    private readonly cfg: CliConfig,
    private readonly accessToken: string,
  ) {}

  static async create(): Promise<ReviewApiClient> {
    const cfg = loadCliConfig()
    const session = await getActiveSession()
    return new ReviewApiClient(cfg, session.accessToken)
  }

  async call<T>(path: string, opts: CallOptions = {}): Promise<T> {
    const method = opts.method ?? 'GET'
    const url = new URL(`${this.cfg.edgeFunctionsBase}/${path.replace(/^\//, '')}`)
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v))
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      apikey: this.cfg.supabaseKey,
    }
    let bodyStr: string | undefined
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      bodyStr = JSON.stringify(opts.body)
    }

    opts.logger?.trace(opts.scope ?? 'http', `${method} ${url.pathname}${url.search}`, {
      bodyKeys: opts.body && typeof opts.body === 'object' ? Object.keys(opts.body) : undefined,
    })

    const res = await fetch(url, { method, headers, body: bodyStr })
    const text = await res.text()
    let parsed: unknown = undefined
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = text
      }
    }

    opts.logger?.trace(opts.scope ?? 'http', `← ${res.status}`, {
      status: res.status,
    })

    if (!res.ok) {
      const errObj = (parsed as { error?: { code?: string; message?: string; details?: unknown } })
        ?.error
      throw new ApiError(
        res.status,
        errObj?.code ?? 'HTTP_ERROR',
        errObj?.message ?? `HTTP ${res.status}`,
        errObj?.details,
      )
    }

    return parsed as T
  }
}
