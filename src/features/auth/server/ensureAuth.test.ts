import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the auth module
vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

// Mock api-utils
vi.mock('~/server/api-utils', () => ({
  unauthorized: () =>
    Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    ),
}))

import { ensureAuth } from './ensureAuth'
import { auth } from './auth'

const mockGetSession = auth.api.getSession as ReturnType<typeof vi.fn>

describe('ensureAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns session when authenticated', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      session: { id: 'session-1', expiresAt: new Date() },
    }
    mockGetSession.mockResolvedValueOnce(mockSession)

    const request = new Request('http://localhost/api/test', {
      headers: { cookie: 'session=abc123' },
    })

    const session = await ensureAuth(request)
    expect(session.user.id).toBe('user-1')
    expect(session.user.email).toBe('test@example.com')
  })

  it('throws 401 Response when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce(null)

    const request = new Request('http://localhost/api/test')

    try {
      await ensureAuth(request)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      const res = err as Response
      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    }
  })

  it('passes request headers to getSession', async () => {
    mockGetSession.mockResolvedValueOnce(null)

    const headers = new Headers({
      cookie: 'session=abc',
      authorization: 'Bearer token',
    })
    const request = new Request('http://localhost/api/test', { headers })

    try {
      await ensureAuth(request)
    } catch {
      // Expected
    }

    expect(mockGetSession).toHaveBeenCalledWith({ headers: request.headers })
  })
})
