import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SecApiClient } from './client'
import { SecApiError } from './sec-api.error'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('SecApiClient', () => {
  let client: SecApiClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new SecApiClient({ apiKey: 'test-key' })
  })

  describe('searchFilings', () => {
    it('returns typed filing response', async () => {
      const mockResponse = {
        total: { value: 1, relation: 'eq' },
        filings: [
          {
            id: '1',
            accessionNo: '0001-24-000001',
            cik: '123',
            ticker: 'AAPL',
            companyName: 'Apple Inc',
            companyNameLong: 'Apple Inc.',
            formType: '10-K',
            description: 'Annual Report',
            filedAt: '2024-01-01',
            linkToTxt: '',
            linkToHtml: '',
            linkToXbrl: '',
            linkToFilingDetails: '',
            entities: [],
            documentFormatFiles: [],
            dataFiles: [],
            periodOfReport: '2024-12-31',
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await client.searchFilings({
        query: 'formType:"10-K" AND ticker:AAPL',
        size: '1',
      })

      expect(result.total.value).toBe(1)
      expect(result.filings).toHaveLength(1)
      expect(result.filings[0].ticker).toBe('AAPL')
      expect(result.filings[0].formType).toBe('10-K')
    })

    it('throws SecApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      })

      await expect(
        client.searchFilings({ query: 'test' }),
      ).rejects.toThrow(SecApiError)
    })

    it('retries on 429 rate limit', async () => {
      // First call: 429
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      })
      // Retry: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            total: { value: 0, relation: 'eq' },
            filings: [],
          }),
      })

      const result = await client.searchFilings({ query: 'test' })
      expect(result.filings).toHaveLength(0)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('mappingByTicker', () => {
    it('returns company mappings for a ticker', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              name: 'Apple Inc.',
              ticker: 'AAPL',
              cik: '0000320193',
              exchange: 'NASDAQ',
              sector: 'Technology',
              industry: 'Consumer Electronics',
            },
          ]),
      })

      const result = await client.mappingByTicker('AAPL')
      expect(result).toHaveLength(1)
      expect(result[0].ticker).toBe('AAPL')
      expect(result[0].name).toBe('Apple Inc.')
    })

    it('returns empty array for unknown ticker', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })

      const result = await client.mappingByTicker('ZZZZZ')
      expect(result).toHaveLength(0)
    })
  })

  describe('getCompensationByTicker', () => {
    it('returns compensation data with normalized values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            total: { value: 1, relation: 'eq' },
            data: [
              {
                ticker: 'TEST',
                executiveName: 'CEO',
                totalCompensation: 15000000,
                salary: 1200000,
              },
            ],
          }),
      })

      const result = await client.getCompensationByTicker('TEST')
      expect(result.data).toHaveLength(1)
      expect(result.data[0].executiveName).toBe('CEO')
    })
  })

  describe('extractSection', () => {
    it('returns text content for a filing section', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('Risk factors include market volatility...'),
      })

      const result = await client.extractSection(
        'https://example.com/filing.htm',
        '1A',
        'text',
      )
      expect(result).toContain('Risk factors')
    })
  })

  describe('error handling', () => {
    it('includes status code and body in SecApiError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      try {
        await client.searchFilings({ query: 'test' })
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(SecApiError)
        const apiErr = err as SecApiError
        expect(apiErr.statusCode).toBe(500)
        expect(apiErr.responseBody).toBe('Internal Server Error')
      }
    })
  })
})
