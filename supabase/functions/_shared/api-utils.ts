import { corsHeaders } from './cors.ts'

const headers = { ...corsHeaders, 'Content-Type': 'application/json' }

function apiError(code: string, message: string, status: number, details?: unknown): Response {
  return new Response(
    JSON.stringify({
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    }),
    { status, headers },
  )
}

export function badRequest(message: string, details?: unknown) {
  return apiError('BAD_REQUEST', message, 400, details)
}

export function unauthorized(message = 'Authentication required') {
  return apiError('UNAUTHORIZED', message, 401)
}

export function notFound(message: string) {
  return apiError('NOT_FOUND', message, 404)
}

export function validationError(message: string, details?: unknown) {
  return apiError('VALIDATION_FAILED', message, 422, details)
}

export function internalError(message = 'An unexpected error occurred') {
  return apiError('INTERNAL_ERROR', message, 500)
}

export function externalServiceError(service: string, message: string) {
  return apiError('EXTERNAL_SERVICE_ERROR', `${service} error: ${message}`, 502)
}

export function incompleteProfile(message: string) {
  return apiError('INCOMPLETE_PROFILE', message, 400)
}

/** Classify an unknown error into a standardized Response. */
export function classifyError(err: unknown): Response {
  if (err instanceof Response) return err

  const message = err instanceof Error ? err.message : String(err)

  if (message.includes('429') || /rate.?limit/i.test(message)) {
    return apiError('RATE_LIMITED', 'Rate limit reached. Please try again.', 429)
  }
  if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
    return externalServiceError('Network', 'Unable to reach external service')
  }
  if (message.includes('anthropic') || message.includes('claude') || message.includes('openai')) {
    return externalServiceError('AI', message)
  }
  if (/not\s*found/i.test(message) || /no\s*company/i.test(message)) {
    return notFound(message)
  }

  return internalError(message)
}
