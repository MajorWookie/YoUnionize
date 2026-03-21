import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase auth client before importing api-client
vi.mock('~/features/auth/client/authClient', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
  }),
}))

import { extractErrorMessage, fetchWithRetry } from './api-client'

describe('api-client', () => {
  describe('extractErrorMessage', () => {
    it('extracts message from new format { error: { code, message } }', () => {
      const data = {
        error: { code: 'BAD_REQUEST', message: 'Ticker is required' },
      }
      expect(extractErrorMessage(data)).toBe('Ticker is required')
    })

    it('extracts message from legacy format { error: string }', () => {
      const data = { error: 'Something went wrong' }
      expect(extractErrorMessage(data)).toBe('Something went wrong')
    })

    it('returns fallback for unrecognized format', () => {
      expect(extractErrorMessage({})).toBe('Something went wrong')
      expect(extractErrorMessage(null)).toBe('Something went wrong')
      expect(extractErrorMessage('string')).toBe('Something went wrong')
    })

    it('handles error object with details', () => {
      const data = {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: ['field required'],
        },
      }
      expect(extractErrorMessage(data)).toBe('Validation failed')
    })
  })

  describe('fetchWithRetry', () => {
    const mockFetch = vi.fn()

    beforeEach(() => {
      vi.clearAllMocks()
      globalThis.fetch = mockFetch as unknown as typeof fetch
    })

    it('returns response on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'test' }),
      })

      const res = await fetchWithRetry('/api/test')
      expect(res.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('does not retry 4xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      })

      const res = await fetchWithRetry('/api/test')
      expect(res.status).toBe(400)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('retries on 5xx errors', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200 })

      const res = await fetchWithRetry('/api/test', undefined, 1)
      expect(res.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('retries on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce({ ok: true, status: 200 })

      const res = await fetchWithRetry('/api/test', undefined, 1)
      expect(res.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('throws after all retries exhausted', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))

      await expect(
        fetchWithRetry('/api/test', undefined, 2),
      ).rejects.toThrow('network error')
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })
})
