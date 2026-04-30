/**
 * Standardized API error responses and request logging.
 *
 * Error shape: { error: { code: string, message: string, details?: unknown } }
 */

// ── Error codes ─────────────────────────────────────────────────────────

export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  INCOMPLETE_PROFILE: 'INCOMPLETE_PROFILE',
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

// ── Error response builder ──────────────────────────────────────────────

export function apiError(
  code: ErrorCodeValue,
  message: string,
  status: number,
  details?: unknown,
): Response {
  return Response.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status },
  )
}

// ── Convenience helpers ─────────────────────────────────────────────────

export function badRequest(message: string, details?: unknown) {
  return apiError(ErrorCode.BAD_REQUEST, message, 400, details)
}

export function unauthorized(message = 'Authentication required') {
  return apiError(ErrorCode.UNAUTHORIZED, message, 401)
}

export function notFound(message: string) {
  return apiError(ErrorCode.NOT_FOUND, message, 404)
}

export function rateLimited(message = 'Too many requests. Please try again later.') {
  return apiError(ErrorCode.RATE_LIMITED, message, 429)
}

export function validationError(message: string, details?: unknown) {
  return apiError(ErrorCode.VALIDATION_FAILED, message, 422, details)
}

export function internalError(message = 'An unexpected error occurred') {
  return apiError(ErrorCode.INTERNAL_ERROR, message, 500)
}

export function externalServiceError(service: string, message: string) {
  return apiError(
    ErrorCode.EXTERNAL_SERVICE_ERROR,
    `${service} error: ${message}`,
    502,
  )
}

export function incompleteProfile(message: string) {
  return apiError(ErrorCode.INCOMPLETE_PROFILE, message, 400)
}

// ── Error classification ────────────────────────────────────────────────

export function classifyError(err: unknown): Response {
  if (err instanceof Response) {
    // Already a Response (e.g. from ensureAuth) — re-throw
    throw err
  }

  const message = err instanceof Error ? err.message : String(err)

  // SEC API rate limiting
  if (message.includes('429') || /rate.?limit/i.test(message)) {
    return rateLimited('SEC API rate limit reached. Please try again in a moment.')
  }

  // Network / fetch failures
  if (
    message.includes('fetch failed') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('network')
  ) {
    return externalServiceError('Network', 'Unable to reach external service')
  }

  // Claude / AI failures
  if (message.includes('anthropic') || message.includes('claude') || message.includes('openai')) {
    return externalServiceError('AI', message)
  }

  // Not found patterns
  if (/not\s*found/i.test(message) || /no\s*company/i.test(message)) {
    return notFound(message)
  }

  return internalError(message)
}

// ── Request logging wrapper ─────────────────────────────────────────────

interface HandlerMap {
  GET?: (request: Request) => Promise<Response> | Response
  POST?: (request: Request) => Promise<Response> | Response
  PUT?: (request: Request) => Promise<Response> | Response
  PATCH?: (request: Request) => Promise<Response> | Response
  DELETE?: (request: Request) => Promise<Response> | Response
}

/**
 * Wraps API route handlers with request logging (method, path, status, duration).
 * Returns individual named exports for each HTTP method.
 *
 * Usage:
 *   const handlers = withLogging('/api/example', { GET: async (req) => { ... } })
 *   export const GET = handlers.GET
 */
export function withLogging<T extends HandlerMap>(
  routeName: string,
  handlers: T,
): T {
  const wrapped = {} as Record<string, unknown>

  for (const [method, handler] of Object.entries(handlers)) {
    if (typeof handler !== 'function') continue

    wrapped[method] = async (request: Request) => {
      const start = performance.now()
      let status = 500

      try {
        const response = await (handler as (req: Request) => Promise<Response>)(request)
        status = response.status
        return response
      } catch (err) {
        if (err instanceof Response) {
          status = err.status
          throw err
        }
        const errorResponse = classifyError(err)
        status = errorResponse.status
        return errorResponse
      } finally {
        const duration = Math.round(performance.now() - start)
        console.info(`[API] ${method} ${routeName} → ${status} (${duration}ms)`)
      }
    }
  }

  return wrapped as T
}
