import * as v from 'valibot'
import {
  DEFAULT_PAGE_SIZE,
  MAX_OFFSET,
  MAX_PAGE_SIZE,
  SEC_API_BASE_URL,
} from './sec-api.constants'
import type { ElasticsearchQuery, SectionItem } from './sec-api.constants'
import { SecApiError } from './sec-api.error'
import {
  CompanyMappingArraySchema,
  DirectorsResponseSchema,
  ExecutiveCompensationResponseSchema,
  FilingQueryResponseSchema,
  Form8KResponseSchema,
  FullTextSearchResponseSchema,
  InsiderTradingResponseSchema,
} from './sec-api.schemas'
import type {
  CompanyMapping,
  ExecutiveCompensationResponse,
  FilingQueryResponse,
  Form8KResponse,
  FullTextSearchRequest,
  FullTextSearchResponse,
  DirectorsResponse,
  InsiderTradingResponse,
  PaginationOptions,
  SecApiClientConfig,
  XbrlLookupBy,
  XbrlResponse,
} from './sec-api.types'

const INITIAL_BACKOFF_MS = 500
const MAX_RETRIES = 3
const BACKOFF_MULTIPLIER = 2

/**
 * Typed client for the sec-api.io API.
 *
 * @example
 * ```ts
 * const client = new SecApiClient({ apiKey: 'your-key' })
 * const filings = await client.searchFilings({
 *   query: 'formType:"10-K" AND ticker:AAPL',
 *   size: '10',
 * })
 * ```
 */
export class SecApiClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(config: SecApiClientConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl ?? SEC_API_BASE_URL
  }

  // ─── Core HTTP ──────────────────────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit & { parseJson?: boolean } = {},
  ): Promise<T> {
    const { parseJson = true, ...fetchOptions } = options
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`

    let lastError: SecApiError | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = INITIAL_BACKOFF_MS * BACKOFF_MULTIPLIER ** (attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          Authorization: this.apiKey,
          ...fetchOptions.headers,
        },
      })

      if (response.status === 429 && attempt < MAX_RETRIES) {
        lastError = new SecApiError(429, 'Rate limited', url)
        continue
      }

      if (!response.ok) {
        const body = await response.text()
        throw new SecApiError(response.status, body, url)
      }

      if (!parseJson) {
        return (await response.text()) as T
      }

      return (await response.json()) as T
    }

    throw lastError
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  private async get<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const searchParams = new URLSearchParams({
      token: this.apiKey,
      ...params,
    })
    return this.request<T>(`${path}?${searchParams.toString()}`)
  }

  private async getText(
    path: string,
    params?: Record<string, string>,
  ): Promise<string> {
    const searchParams = new URLSearchParams({
      token: this.apiKey,
      ...params,
    })
    return this.request<string>(`${path}?${searchParams.toString()}`, {
      parseJson: false,
    })
  }

  // ─── Filing Query API ─────────────────────────────────────────────────

  /** Search SEC EDGAR filings using Lucene query syntax. */
  async searchFilings(
    query: ElasticsearchQuery,
  ): Promise<FilingQueryResponse> {
    const raw = await this.post<unknown>('', query)
    return v.parse(FilingQueryResponseSchema, raw) as FilingQueryResponse
  }

  // ─── Full-Text Search API ─────────────────────────────────────────────

  /** Full-text search across filing content. */
  async fullTextSearch(
    request: FullTextSearchRequest,
  ): Promise<FullTextSearchResponse> {
    const raw = await this.post<unknown>('/full-text-search', request)
    return v.parse(FullTextSearchResponseSchema, raw) as FullTextSearchResponse
  }

  // ─── Section Extractor ────────────────────────────────────────────────

  /** Extract a specific section from a 10-K, 10-Q, or 8-K filing. */
  async extractSection(
    url: string,
    item: SectionItem,
    type: 'text' | 'html' = 'text',
  ): Promise<string> {
    return this.getText('/extractor', { url, item, type })
  }

  // ─── XBRL-to-JSON Converter ──────────────────────────────────────────

  /** Convert XBRL financial data from SEC filings into structured JSON. */
  async xbrlToJson(lookup: XbrlLookupBy): Promise<XbrlResponse> {
    const params: Record<string, string> = {}
    if ('htmUrl' in lookup) params['htm-url'] = lookup.htmUrl
    else if ('xbrlUrl' in lookup) params['xbrl-url'] = lookup.xbrlUrl
    else params['accession-no'] = lookup.accessionNo
    return this.get<XbrlResponse>('/xbrl-to-json', params)
  }

  // ─── Executive Compensation ───────────────────────────────────────────

  /** Get executive compensation by ticker symbol. Values are in whole dollars. */
  async getCompensationByTicker(
    ticker: string,
  ): Promise<ExecutiveCompensationResponse> {
    const raw = await this.get<unknown>(`/compensation/${encodeURIComponent(ticker)}`)
    return this.parseCompensation(raw)
  }

  /** Get executive compensation by CIK number. Values are in whole dollars. */
  async getCompensationByCik(
    cik: string,
  ): Promise<ExecutiveCompensationResponse> {
    const raw = await this.get<unknown>(`/compensation/${encodeURIComponent(cik)}`)
    return this.parseCompensation(raw)
  }

  /** Search executive compensation with custom queries. Values are in whole dollars. */
  async searchCompensation(
    query: ElasticsearchQuery,
  ): Promise<ExecutiveCompensationResponse> {
    const raw = await this.post<unknown>('/compensation', query)
    return this.parseCompensation(raw)
  }

  private parseCompensation(raw: unknown): ExecutiveCompensationResponse {
    const parsed = v.parse(ExecutiveCompensationResponseSchema, raw)
    // API returns a plain array for GET, or { data: [...] } for POST
    const data = Array.isArray(parsed) ? parsed : parsed.data
    return { data }
  }

  // ─── Directors & Board Members ────────────────────────────────────────

  /** Search directors and board member data. */
  async searchDirectors(
    query: ElasticsearchQuery,
  ): Promise<DirectorsResponse> {
    const raw = await this.post<unknown>('/directors-and-board-members', query)
    return v.parse(DirectorsResponseSchema, raw) as DirectorsResponse
  }

  // ─── Insider Trading (Form 3/4/5) ────────────────────────────────────

  /** Search Form 3, 4, and 5 insider trading transactions. */
  async searchInsiderTrading(
    query: ElasticsearchQuery,
  ): Promise<InsiderTradingResponse> {
    const raw = await this.post<unknown>('/insider-trading', query)
    return v.parse(InsiderTradingResponseSchema, raw) as InsiderTradingResponse
  }

  // ─── Form 8-K Structured Data ────────────────────────────────────────

  /** Search Form 8-K structured data (auditor changes, restatements, officer changes). */
  async searchForm8K(query: ElasticsearchQuery): Promise<Form8KResponse> {
    const raw = await this.post<unknown>('/form-8k', query)
    return v.parse(Form8KResponseSchema, raw) as Form8KResponse
  }

  // ─── Data Mapping ────────────────────────────────────────────────────

  /** Resolve a CIK to company details. */
  async mappingByCik(cik: string): Promise<Array<CompanyMapping>> {
    const raw = await this.get<unknown>(`/mapping/cik/${encodeURIComponent(cik)}`)
    return v.parse(CompanyMappingArraySchema, raw) as Array<CompanyMapping>
  }

  /** Resolve a ticker to company details. */
  async mappingByTicker(ticker: string): Promise<Array<CompanyMapping>> {
    const raw = await this.get<unknown>(`/mapping/ticker/${encodeURIComponent(ticker)}`)
    return v.parse(CompanyMappingArraySchema, raw) as Array<CompanyMapping>
  }

  /** Resolve a CUSIP to company details. */
  async mappingByCusip(cusip: string): Promise<Array<CompanyMapping>> {
    const raw = await this.get<unknown>(`/mapping/cusip/${encodeURIComponent(cusip)}`)
    return v.parse(CompanyMappingArraySchema, raw) as Array<CompanyMapping>
  }

  /** Search companies by name. */
  async mappingByName(name: string): Promise<Array<CompanyMapping>> {
    const raw = await this.get<unknown>(`/mapping/name/${encodeURIComponent(name)}`)
    return v.parse(CompanyMappingArraySchema, raw) as Array<CompanyMapping>
  }

  // ─── Pagination Helper ───────────────────────────────────────────────

  /**
   * Async generator that paginates through all results for a search query.
   *
   * @example
   * ```ts
   * for await (const page of client.paginateFilings({ query: 'ticker:AAPL' })) {
   *   for (const filing of page.filings) {
   *     console.info(filing.companyName)
   *   }
   * }
   * ```
   */
  async *paginateFilings(
    query: Omit<ElasticsearchQuery, 'from' | 'size'>,
    options?: PaginationOptions,
  ): AsyncGenerator<FilingQueryResponse> {
    let from = options?.from ?? 0
    const size = Math.min(options?.size ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

    while (from < MAX_OFFSET) {
      const response = await this.searchFilings({
        ...query,
        from: String(from),
        size: String(size),
      })

      yield response

      if (response.filings.length < size || from + size >= MAX_OFFSET) {
        break
      }

      from += size
    }
  }

  /**
   * Async generator that paginates through insider trading results.
   */
  async *paginateInsiderTrading(
    query: Omit<ElasticsearchQuery, 'from' | 'size'>,
    options?: PaginationOptions,
  ): AsyncGenerator<InsiderTradingResponse> {
    let from = options?.from ?? 0
    const size = Math.min(options?.size ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

    while (from < MAX_OFFSET) {
      const response = await this.searchInsiderTrading({
        ...query,
        from: String(from),
        size: String(size),
      })

      yield response

      if (response.transactions.length < size || from + size >= MAX_OFFSET) {
        break
      }

      from += size
    }
  }
}
