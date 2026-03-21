import { describe, it, expect, vi } from 'vitest'
import {
  apiError,
  badRequest,
  unauthorized,
  notFound,
  rateLimited,
  validationError,
  internalError,
  externalServiceError,
  incompleteProfile,
  classifyError,
  withLogging,
  ErrorCode,
} from './api-utils'

describe('api-utils', () => {
  describe('apiError', () => {
    it('creates Response with correct status and body', async () => {
      const res = apiError(ErrorCode.BAD_REQUEST, 'test error', 400)
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error.code).toBe('BAD_REQUEST')
      expect(body.error.message).toBe('test error')
    })

    it('includes details when provided', async () => {
      const res = apiError(ErrorCode.VALIDATION_FAILED, 'invalid', 422, ['field required'])
      const body = await res.json()
      expect(body.error.details).toEqual(['field required'])
    })

    it('omits details when undefined', async () => {
      const res = apiError(ErrorCode.INTERNAL_ERROR, 'error', 500)
      const body = await res.json()
      expect(body.error).not.toHaveProperty('details')
    })
  })

  describe('convenience helpers', () => {
    it('badRequest returns 400', () => {
      expect(badRequest('bad').status).toBe(400)
    })

    it('unauthorized returns 401', () => {
      expect(unauthorized().status).toBe(401)
    })

    it('notFound returns 404', () => {
      expect(notFound('missing').status).toBe(404)
    })

    it('rateLimited returns 429', () => {
      expect(rateLimited().status).toBe(429)
    })

    it('validationError returns 422', () => {
      expect(validationError('invalid').status).toBe(422)
    })

    it('internalError returns 500', () => {
      expect(internalError().status).toBe(500)
    })

    it('externalServiceError returns 502', async () => {
      const res = externalServiceError('SEC', 'timeout')
      expect(res.status).toBe(502)
      const body = await res.json()
      expect(body.error.message).toContain('SEC error: timeout')
    })

    it('incompleteProfile returns 400', () => {
      expect(incompleteProfile('missing pay').status).toBe(400)
    })
  })

  describe('classifyError', () => {
    it('re-throws Response instances', () => {
      const res = new Response('test', { status: 401 })
      expect(() => classifyError(res)).toThrow()
    })

    it('classifies 429 as rate limited', () => {
      const result = classifyError(new Error('got 429 from API'))
      expect(result.status).toBe(429)
    })

    it('classifies rate limit text', () => {
      const result = classifyError(new Error('Rate limit exceeded'))
      expect(result.status).toBe(429)
    })

    it('classifies fetch failures as external service', () => {
      const result = classifyError(new Error('fetch failed'))
      expect(result.status).toBe(502)
    })

    it('classifies ECONNREFUSED as external service', () => {
      const result = classifyError(new Error('ECONNREFUSED'))
      expect(result.status).toBe(502)
    })

    it('classifies anthropic errors as AI service', () => {
      const result = classifyError(new Error('anthropic API key invalid'))
      expect(result.status).toBe(502)
    })

    it('classifies not found patterns', () => {
      const result = classifyError(new Error('Company not found'))
      expect(result.status).toBe(404)
    })

    it('classifies no company patterns', () => {
      const result = classifyError(new Error('No company found for ticker XYZ'))
      expect(result.status).toBe(404)
    })

    it('defaults to 500 internal error', () => {
      const result = classifyError(new Error('something unexpected'))
      expect(result.status).toBe(500)
    })

    it('handles string errors', () => {
      const result = classifyError('string error')
      expect(result.status).toBe(500)
    })
  })

  describe('withLogging', () => {
    it('wraps handlers and preserves response', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

      const handlers = withLogging('/api/test', {
        async GET(_req: Request) {
          return Response.json({ ok: true })
        },
      })

      const req = new Request('http://localhost/api/test')
      const res = await handlers.GET!(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.ok).toBe(true)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[API\] GET \/api\/test → 200 \(\d+ms\)/),
      )

      consoleSpy.mockRestore()
    })

    it('catches errors and returns classified response', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

      const handlers = withLogging('/api/test', {
        async GET(_req: Request): Promise<Response> {
          throw new Error('Something broke')
        },
      })

      const req = new Request('http://localhost/api/test')
      const res = await handlers.GET!(req)
      expect(res.status).toBe(500)

      consoleSpy.mockRestore()
    })

    it('re-throws Response errors (from ensureAuth)', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

      const authResponse = Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Auth required' } },
        { status: 401 },
      )

      const handlers = withLogging('/api/test', {
        async GET(_req: Request) {
          throw authResponse
        },
      })

      const req = new Request('http://localhost/api/test')
      await expect(handlers.GET!(req)).rejects.toBe(authResponse)

      consoleSpy.mockRestore()
    })

    it('logs correct duration', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

      const handlers = withLogging('/api/slow', {
        async POST(_req: Request) {
          await new Promise((r) => setTimeout(r, 50))
          return Response.json({ done: true })
        },
      })

      const req = new Request('http://localhost/api/slow', { method: 'POST' })
      await handlers.POST!(req)

      const logCall = consoleSpy.mock.calls.find((c) =>
        String(c[0]).includes('/api/slow'),
      )
      expect(logCall).toBeDefined()
      // Duration should be at least 40ms
      const match = String(logCall![0]).match(/\((\d+)ms\)/)
      expect(Number(match![1])).toBeGreaterThanOrEqual(40)

      consoleSpy.mockRestore()
    })
  })
})
