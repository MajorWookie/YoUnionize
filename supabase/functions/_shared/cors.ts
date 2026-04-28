const ALLOWED_ORIGINS = [
  'https://younionize.me',
  'https://www.younionize.me',
]

const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
]

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin',
  }
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

// Backwards-compatible re-export — existing handlers can keep importing
// `corsHeaders`, but it's now a frozen baseline (no Allow-Origin).
// New code should prefer `buildCorsHeaders(req)` to get a request-scoped
// allowlist-checked Origin header.
export const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Vary': 'Origin',
}

export function handleCors(req: Request): Response {
  return new Response('ok', { headers: buildCorsHeaders(req) })
}

export function jsonResponse(data: unknown, status = 200, req?: Request): Response {
  const cors = req ? buildCorsHeaders(req) : corsHeaders
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
