import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase module
vi.mock('./supabase', () => ({
  createRequestClient: vi.fn(),
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
import { createRequestClient } from './supabase'

const mockCreateRequestClient = createRequestClient as ReturnType<typeof vi.fn>

describe('ensureAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns session when authenticated', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      user_metadata: { name: 'Test' },
    }
    mockCreateRequestClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    })

    const request = new Request('http://localhost/api/test', {
      headers: { authorization: 'Bearer test-token' },
    })

    const session = await ensureAuth(request)
    expect(session.user.id).toBe('user-1')
    expect(session.user.email).toBe('test@example.com')
    expect(session.user.name).toBe('Test')
  })

  it('throws 401 Response when not authenticated', async () => {
    mockCreateRequestClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } }),
      },
    })

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

  it('creates a request client with the request', async () => {
    mockCreateRequestClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'no session' } }),
      },
    })

    const request = new Request('http://localhost/api/test', {
      headers: {
        authorization: 'Bearer token',
      },
    })

    try {
      await ensureAuth(request)
    } catch {
      // Expected
    }

    expect(mockCreateRequestClient).toHaveBeenCalledWith(request)
  })
})
