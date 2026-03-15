import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SecApiClient } from '../client'
import { SecApiError } from '../sec-api.error'

// ─── Mock Responses ─────────────────────────────────────────────────────────

const MOCK_FILING = {
  id: 'abc123',
  accessionNo: '0001193125-24-012345',
  cik: '320193',
  ticker: 'AAPL',
  companyName: 'Apple Inc.',
  companyNameLong: 'Apple Inc.',
  formType: '10-K',
  description: 'Form 10-K - Annual report',
  filedAt: '2024-10-31T16:05:22-04:00',
  linkToTxt: 'https://www.sec.gov/Archives/edgar/data/320193/filing.txt',
  linkToHtml: 'https://www.sec.gov/Archives/edgar/data/320193/filing.htm',
  linkToXbrl: '',
  linkToFilingDetails:
    'https://www.sec.gov/Archives/edgar/data/320193/filing-details.htm',
  entities: [
    {
      companyName: 'Apple Inc.',
      cik: '320193',
      ticker: 'AAPL',
      irsNo: '942404110',
      stateOfIncorporation: 'CA',
      fiscalYearEnd: '0930',
      type: '10-K',
    },
  ],
  documentFormatFiles: [],
  dataFiles: [],
  periodOfReport: '2024-09-28',
}

const MOCK_FILING_RESPONSE = {
  total: { value: 42, relation: 'eq' },
  filings: [MOCK_FILING],
}

const MOCK_FULL_TEXT_RESPONSE = {
  total: { value: 5, relation: 'eq' },
  filings: [
    {
      id: 'fts-1',
      accessionNo: '0001193125-24-999999',
      cik: '320193',
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      formType: '10-K',
      filedAt: '2024-10-31',
      documentUrl: 'https://www.sec.gov/doc.htm',
      description: 'Annual report',
      highlight: '...substantial <em>doubt</em> about...',
    },
  ],
}

const MOCK_COMPENSATION = {
  total: { value: 1, relation: 'eq' },
  data: [
    {
      ticker: 'AAPL',
      cik: '320193',
      companyName: 'Apple Inc.',
      executiveName: 'Tim Cook',
      position: 'Chief Executive Officer',
      reportingYear: 2023,
      salary: 3000000,
      bonus: 0,
      stockAwards: 40000000,
      optionAwards: 0,
      incentiveCompensation: 12000000,
      pensionChanges: 0,
      otherCompensation: 1500000,
      totalCompensation: 56500000,
      ceoPayRatio: '672:1',
      accessionNo: '0001193125-24-012345',
      filedAt: '2024-01-15',
    },
  ],
}

const MOCK_DIRECTORS = {
  total: { value: 2, relation: 'eq' },
  data: [
    {
      ticker: 'AAPL',
      cik: '320193',
      companyName: 'Apple Inc.',
      name: 'Arthur D. Levinson',
      position: 'Chairman of the Board',
      age: 73,
      directorClass: null,
      dateFirstElected: '2000-11-01',
      isIndependent: true,
      committeeMemberships: ['Compensation', 'Nominating'],
      qualificationsAndExperience: ['Technology', 'Healthcare'],
      accessionNo: '0001193125-24-012345',
      filedAt: '2024-01-15',
    },
  ],
}

const MOCK_INSIDER_TRADE = {
  total: { value: 1, relation: 'eq' },
  data: [
    {
      id: 'it-1',
      accessionNo: '0001193125-24-111111',
      formType: '4',
      filedAt: '2024-06-15',
      issuer: {
        cik: '1318605',
        name: 'Tesla, Inc.',
        tradingSymbol: 'TSLA',
      },
      reportingOwner: {
        cik: '1494730',
        name: 'Elon Musk',
        isDirector: true,
        isOfficer: true,
        officerTitle: 'CEO',
        isTenPercentOwner: true,
      },
      nonDerivativeTable: {
        transactions: [
          {
            transactionDate: '2024-06-14',
            transactionCode: 'S',
            transactionDescription: 'Sale',
            sharesTraded: 50000,
            pricePerShare: 180.5,
            sharesOwnedAfter: 411000000,
            directOrIndirect: 'D',
            securityTitle: 'Common Stock',
          },
        ],
      },
      derivativeTable: null,
      periodOfReport: '2024-06-14',
    },
  ],
}

const MOCK_FORM_8K = {
  total: { value: 1, relation: 'eq' },
  data: [
    {
      id: '8k-1',
      accessionNo: '0001193125-24-222222',
      cik: '320193',
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      formType: '8-K',
      filedAt: '2024-03-01',
      items: {
        item502: {
          personnelChanges: [
            {
              personName: 'John Doe',
              changeType: 'appointment',
              position: 'Chief Financial Officer',
              effectiveDate: '2024-04-01',
            },
          ],
          bonusPlans: [],
          organizationChanges: [],
        },
      },
    },
  ],
}

const MOCK_MAPPING = [
  {
    name: 'Apple Inc.',
    ticker: 'AAPL',
    cik: '320193',
    cusip: '037833100',
    exchange: 'NASDAQ',
    isDelisted: false,
    category: 'Domestic',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    sic: '3571',
    currency: 'USD',
    location: 'California',
  },
]

// ─── Test Setup ─────────────────────────────────────────────────────────────

function createMockFetch(responseData: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(responseData),
    text: () =>
      Promise.resolve(
        typeof responseData === 'string'
          ? responseData
          : JSON.stringify(responseData),
      ),
  })
}

describe('SecApiClient', () => {
  let client: SecApiClient
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    client = new SecApiClient({ apiKey: 'test-api-key' })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // ─── Filing Query API ───────────────────────────────────────────────

  describe('searchFilings', () => {
    it('sends POST to base URL with query and returns parsed filings', async () => {
      const mockFetch = createMockFetch(MOCK_FILING_RESPONSE)
      globalThis.fetch = mockFetch

      const result = await client.searchFilings({
        query: 'formType:"10-K" AND ticker:AAPL',
        from: '0',
        size: '10',
      })

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://efts.sec-api.io')
      expect(options.method).toBe('POST')
      expect(options.headers).toEqual(
        expect.objectContaining({
          Authorization: 'test-api-key',
          'Content-Type': 'application/json',
        }),
      )
      const body = JSON.parse(options.body as string)
      expect(body.query).toBe('formType:"10-K" AND ticker:AAPL')

      expect(result.total.value).toBe(42)
      expect(result.filings).toHaveLength(1)
      expect(result.filings[0].ticker).toBe('AAPL')
      expect(result.filings[0].formType).toBe('10-K')
    })
  })

  // ─── Full-Text Search API ──────────────────────────────────────────

  describe('fullTextSearch', () => {
    it('sends POST to /full-text-search', async () => {
      const mockFetch = createMockFetch(MOCK_FULL_TEXT_RESPONSE)
      globalThis.fetch = mockFetch

      const result = await client.fullTextSearch({
        query: 'substantial doubt',
        formTypes: ['10-K', '10-Q'],
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      })

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toBe('https://efts.sec-api.io/full-text-search')
      expect(result.filings).toHaveLength(1)
      expect(result.filings[0].highlight).toContain('doubt')
    })
  })

  // ─── Section Extractor ────────────────────────────────────────────

  describe('extractSection', () => {
    it('sends GET to /extractor with query params', async () => {
      const sectionText = 'Risk Factors: The company faces significant risks...'
      const mockFetch = createMockFetch(sectionText)
      globalThis.fetch = mockFetch

      const result = await client.extractSection(
        'https://www.sec.gov/Archives/edgar/data/320193/filing.htm',
        '1A',
        'text',
      )

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/extractor?')
      expect(url).toContain('item=1A')
      expect(url).toContain('type=text')
      expect(result).toBe(sectionText)
    })
  })

  // ─── XBRL-to-JSON ────────────────────────────────────────────────

  describe('xbrlToJson', () => {
    it('supports lookup by htm URL', async () => {
      const mockXbrl = { StatementsOfIncome: { Revenue: 394328000000 } }
      const mockFetch = createMockFetch(mockXbrl)
      globalThis.fetch = mockFetch

      const result = await client.xbrlToJson({
        htmUrl: 'https://www.sec.gov/filing.htm',
      })

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/xbrl-to-json?')
      expect(url).toContain('htm-url=')
      expect(result).toHaveProperty('StatementsOfIncome')
    })

    it('supports lookup by accession number', async () => {
      const mockFetch = createMockFetch({ BalanceSheets: {} })
      globalThis.fetch = mockFetch

      await client.xbrlToJson({ accessionNo: '0001193125-24-012345' })

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('accession-no=0001193125-24-012345')
    })
  })

  // ─── Executive Compensation ──────────────────────────────────────

  describe('getCompensationByTicker', () => {
    it('normalizes monetary values to cents', async () => {
      const mockFetch = createMockFetch(MOCK_COMPENSATION)
      globalThis.fetch = mockFetch

      const result = await client.getCompensationByTicker('AAPL')

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/compensation/AAPL?')

      const exec = result.data[0]
      // $3,000,000 → 300,000,000 cents
      expect(exec.salary).toBe(300_000_000)
      // $56,500,000 → 5,650,000,000 cents
      expect(exec.totalCompensation).toBe(5_650_000_000)
      expect(exec.ceoPayRatio).toBe('672:1')
    })
  })

  describe('searchCompensation', () => {
    it('sends POST to /compensation and normalizes to cents', async () => {
      const mockFetch = createMockFetch(MOCK_COMPENSATION)
      globalThis.fetch = mockFetch

      const result = await client.searchCompensation({
        query: 'ticker:AAPL AND reportingYear:2023',
      })

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://efts.sec-api.io/compensation')
      expect(options.method).toBe('POST')
      expect(result.data[0].salary).toBe(300_000_000)
    })
  })

  // ─── Directors & Board Members ───────────────────────────────────

  describe('searchDirectors', () => {
    it('sends POST to /directors-and-board-members', async () => {
      const mockFetch = createMockFetch(MOCK_DIRECTORS)
      globalThis.fetch = mockFetch

      const result = await client.searchDirectors({
        query: 'ticker:AAPL AND isIndependent:true',
      })

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toBe(
        'https://efts.sec-api.io/directors-and-board-members',
      )
      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Arthur D. Levinson')
      expect(result.data[0].isIndependent).toBe(true)
    })
  })

  // ─── Insider Trading ─────────────────────────────────────────────

  describe('searchInsiderTrading', () => {
    it('sends POST to /insider-trading', async () => {
      const mockFetch = createMockFetch(MOCK_INSIDER_TRADE)
      globalThis.fetch = mockFetch

      const result = await client.searchInsiderTrading({
        query: 'issuer.tradingSymbol:TSLA',
      })

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toBe('https://efts.sec-api.io/insider-trading')
      expect(result.data).toHaveLength(1)
      expect(result.data[0].reportingOwner?.name).toBe('Elon Musk')
      expect(
        result.data[0].nonDerivativeTable?.transactions?.[0].sharesTraded,
      ).toBe(50000)
    })
  })

  // ─── Form 8-K ────────────────────────────────────────────────────

  describe('searchForm8K', () => {
    it('sends POST to /form-8k', async () => {
      const mockFetch = createMockFetch(MOCK_FORM_8K)
      globalThis.fetch = mockFetch

      const result = await client.searchForm8K({
        query: 'ticker:AAPL AND items.item502.personnelChanges.changeType:"appointment"',
      })

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toBe('https://efts.sec-api.io/form-8k')
      expect(result.data).toHaveLength(1)
      expect(result.data[0].items?.item502?.personnelChanges?.[0].personName).toBe(
        'John Doe',
      )
    })
  })

  // ─── Data Mapping ────────────────────────────────────────────────

  describe('mapping', () => {
    it('mappingByTicker resolves ticker to company details', async () => {
      const mockFetch = createMockFetch(MOCK_MAPPING)
      globalThis.fetch = mockFetch

      const result = await client.mappingByTicker('AAPL')

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/mapping/ticker/AAPL?')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Apple Inc.')
      expect(result[0].cusip).toBe('037833100')
    })

    it('mappingByCik resolves CIK', async () => {
      const mockFetch = createMockFetch(MOCK_MAPPING)
      globalThis.fetch = mockFetch

      await client.mappingByCik('320193')
      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/mapping/cik/320193?')
    })

    it('mappingByCusip resolves CUSIP', async () => {
      const mockFetch = createMockFetch(MOCK_MAPPING)
      globalThis.fetch = mockFetch

      await client.mappingByCusip('037833100')
      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/mapping/cusip/037833100?')
    })

    it('mappingByName searches by company name', async () => {
      const mockFetch = createMockFetch(MOCK_MAPPING)
      globalThis.fetch = mockFetch

      await client.mappingByName('Apple')
      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/mapping/name/Apple?')
    })
  })

  // ─── Error Handling ──────────────────────────────────────────────

  describe('error handling', () => {
    it('throws SecApiError on non-2xx responses', async () => {
      const mockFetch = createMockFetch('Unauthorized', 401)
      globalThis.fetch = mockFetch

      await expect(
        client.searchFilings({ query: 'ticker:AAPL' }),
      ).rejects.toThrow(SecApiError)

      try {
        await client.searchFilings({ query: 'ticker:AAPL' })
      } catch (error) {
        expect(error).toBeInstanceOf(SecApiError)
        const secError = error as SecApiError
        expect(secError.statusCode).toBe(401)
        expect(secError.responseBody).toBe('Unauthorized')
      }
    })

    it('retries on 429 rate limit with exponential backoff', async () => {
      let callCount = 0
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            text: () => Promise.resolve('Rate limited'),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(MOCK_FILING_RESPONSE),
          text: () => Promise.resolve(JSON.stringify(MOCK_FILING_RESPONSE)),
        })
      })

      const result = await client.searchFilings({ query: 'ticker:AAPL' })

      expect(callCount).toBe(3)
      expect(result.filings).toHaveLength(1)
    })
  })

  // ─── Pagination Helper ──────────────────────────────────────────

  describe('paginateFilings', () => {
    it('iterates through pages until results exhausted', async () => {
      let callCount = 0
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++
        const isLastPage = callCount >= 3
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              total: { value: 120, relation: 'eq' },
              filings: isLastPage
                ? [MOCK_FILING]
                : Array.from({ length: 50 }, () => MOCK_FILING),
            }),
        })
      })

      const pages: Array<unknown> = []
      for await (const page of client.paginateFilings({
        query: 'ticker:AAPL',
      })) {
        pages.push(page)
      }

      expect(pages).toHaveLength(3)
      expect(callCount).toBe(3)
    })

    it('respects custom page size', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            total: { value: 5, relation: 'eq' },
            filings: Array.from({ length: 5 }, () => MOCK_FILING),
          }),
      })

      const pages: Array<unknown> = []
      for await (const page of client.paginateFilings(
        { query: 'ticker:AAPL' },
        { size: 10 },
      )) {
        pages.push(page)
      }

      const body = JSON.parse(
        (vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit)
          .body as string,
      )
      expect(body.size).toBe('10')
    })
  })

  // ─── Custom Base URL ─────────────────────────────────────────────

  describe('custom config', () => {
    it('uses custom base URL when provided', async () => {
      const customClient = new SecApiClient({
        apiKey: 'test-key',
        baseUrl: 'https://custom-api.example.com',
      })

      const mockFetch = createMockFetch(MOCK_FILING_RESPONSE)
      globalThis.fetch = mockFetch

      await customClient.searchFilings({ query: 'ticker:AAPL' })

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toBe('https://custom-api.example.com')
    })
  })
})
