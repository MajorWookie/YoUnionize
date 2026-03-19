import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaudeClient } from '../claude'
import type { FilingSummaryResult, CompensationAnalysisResult } from '../types'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_FILING_SUMMARY: FilingSummaryResult = {
  executive_summary:
    'Apple reported record revenue of $394 billion for fiscal year 2024, up 2% from last year. Profits grew modestly despite increased R&D spending.',
  key_numbers: [
    {
      label: 'Annual Revenue',
      value: '$394.3 billion',
      context:
        "That's roughly $1.08 billion per day — more than most countries' GDP",
    },
    {
      label: 'Net Income',
      value: '$97 billion',
      context:
        'The company keeps about 25 cents of every dollar it earns as profit',
    },
    {
      label: 'Employees',
      value: '161,000',
      context:
        'Revenue per employee is about $2.4 million — extremely high for any industry',
    },
  ],
  plain_language_explanation:
    'Apple had a strong year financially. Revenue grew slightly, driven by services (iCloud, App Store, Apple Music) rather than iPhone sales, which were flat. The company spent more on research and development, which could mean new products are coming.',
  red_flags: [
    'iPhone revenue was flat year-over-year, suggesting market saturation',
    'China revenue declined 8% amid geopolitical tensions',
  ],
  opportunities: [
    'Services revenue grew 14% and has higher profit margins than hardware',
    'Company has $162 billion in cash reserves',
  ],
  employee_relevance:
    'Apple remains very profitable, which is good for job security and potential raises. The shift toward services means the company may hire more software engineers and fewer hardware designers.',
}

const MOCK_COMPENSATION_ANALYSIS: CompensationAnalysisResult = {
  fairness_score: 42,
  explanation:
    "Apple's CEO Tim Cook earned $63 million in 2023, which is 672 times the median worker's pay of $94,118. While Apple is highly profitable, this ratio is above the S&P 500 average of 272:1.",
  comparisons: [
    {
      label: 'CEO Pay Ratio',
      insight:
        "At 672:1, Apple's CEO-to-worker ratio is 2.5x the S&P 500 average of 272:1",
    },
    {
      label: 'Your Pay vs. Median',
      insight:
        "Your $85,000 salary is about 10% below Apple's median worker pay of $94,118",
    },
    {
      label: 'Revenue Per Employee',
      insight:
        'You help generate ~$2.4M in revenue per employee. Your pay represents about 3.5% of your contribution.',
    },
  ],
  recommendations: [
    'Your pay is below the company median — consider negotiating based on tenure and performance',
    "Research market rates for your role on levels.fyi or Glassdoor",
    "Apple's stock compensation may offset the base salary gap — review your total comp package",
  ],
}

const MOCK_EMBEDDING = Array.from({ length: 1536 }, (_, i) =>
  Math.sin(i * 0.01),
)

// ─── Mock Anthropic SDK ─────────────────────────────────────────────────────

function createMockAnthropicResponse(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    usage: { input_tokens: 1500, output_tokens: 800 },
  }
}

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn(),
      }
    },
  }
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ClaudeClient', () => {
  let client: ClaudeClient
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    client = new ClaudeClient({
      apiKey: 'test-anthropic-key',
      openaiApiKey: 'test-openai-key',
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  function getMockCreate() {
    // Access the mocked create function through the internal anthropic instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (client as any).anthropic.messages.create as ReturnType<typeof vi.fn>
  }

  // ─── summarizeSection ───────────────────────────────────────────────

  describe('summarizeSection', () => {
    it('returns plain text summary for a section', async () => {
      const summaryText =
        'Apple faces significant competition in smartphones and services. The main risk is that iPhone sales have plateaued.'
      getMockCreate().mockResolvedValueOnce(
        createMockAnthropicResponse(summaryText),
      )

      const result = await client.summarizeSection({
        section: 'The Company faces intense competition...',
        sectionType: 'riskFactors',
        companyName: 'Apple Inc.',
        filingType: '10-K',
      })

      expect(result.data).toBe(summaryText)
      expect(result.usage.inputTokens).toBe(1500)
      expect(result.usage.outputTokens).toBe(800)
      expect(result.cached).toBe(false)

      const createCall = getMockCreate().mock.calls[0][0]
      expect(createCall.system).toContain('riskFactors')
      expect(createCall.messages[0].content).toContain('Apple Inc.')
      expect(createCall.messages[0].content).toContain('riskFactors')
    })

    it('uses section-specific guidance in system prompt', async () => {
      getMockCreate().mockResolvedValueOnce(
        createMockAnthropicResponse('Summary of MD&A section'),
      )

      await client.summarizeSection({
        section: 'Management discussion...',
        sectionType: 'mdAndA',
        companyName: 'Tesla Inc.',
        filingType: '10-K',
      })

      const systemPrompt = getMockCreate().mock.calls[0][0].system
      expect(systemPrompt).toContain('mdAndA')
      expect(systemPrompt).toContain('Cash flow')
    })
  })

  // ─── generateFilingSummary ──────────────────────────────────────────

  describe('generateFilingSummary', () => {
    it('returns parsed FilingSummaryResult', async () => {
      getMockCreate().mockResolvedValueOnce(
        createMockAnthropicResponse(JSON.stringify(MOCK_FILING_SUMMARY)),
      )

      const result = await client.generateFilingSummary({
        rawData: { ticker: 'AAPL', revenue: 394000000000 },
        filingType: '10-K',
        companyName: 'Apple Inc.',
      })

      expect(result.data.executive_summary).toContain('record revenue')
      expect(result.data.key_numbers).toHaveLength(3)
      expect(result.data.red_flags).toHaveLength(2)
      expect(result.data.opportunities).toHaveLength(2)
      expect(result.data.employee_relevance).toContain('profitable')
    })

    it('handles JSON wrapped in code fences', async () => {
      const fencedJson = '```json\n' + JSON.stringify(MOCK_FILING_SUMMARY) + '\n```'
      getMockCreate().mockResolvedValueOnce(
        createMockAnthropicResponse(fencedJson),
      )

      const result = await client.generateFilingSummary({
        rawData: { ticker: 'AAPL' },
        filingType: '10-K',
        companyName: 'Apple Inc.',
      })

      expect(result.data.executive_summary).toBeTruthy()
    })

    it('uses filing-summary prompts', async () => {
      getMockCreate().mockResolvedValueOnce(
        createMockAnthropicResponse(JSON.stringify(MOCK_FILING_SUMMARY)),
      )

      await client.generateFilingSummary({
        rawData: { formType: '10-K' },
        filingType: '10-K',
        companyName: 'Tesla Inc.',
      })

      const call = getMockCreate().mock.calls[0][0]
      expect(call.system).toContain('SEC filings in plain language')
      expect(call.system).toContain('executive_summary')
      expect(call.messages[0].content).toContain('Tesla Inc.')
      expect(call.messages[0].content).toContain('10-K')
    })
  })

  // ─── generateCompensationAnalysis ───────────────────────────────────

  describe('generateCompensationAnalysis', () => {
    it('returns parsed CompensationAnalysisResult', async () => {
      getMockCreate().mockResolvedValueOnce(
        createMockAnthropicResponse(
          JSON.stringify(MOCK_COMPENSATION_ANALYSIS),
        ),
      )

      const result = await client.generateCompensationAnalysis({
        companyName: 'Apple Inc.',
        execComp: [
          { executiveName: 'Tim Cook', totalCompensation: 6300000000 },
        ],
        userPay: 8500000, // $85,000 in cents
      })

      expect(result.data.fairness_score).toBe(42)
      expect(result.data.comparisons).toHaveLength(3)
      expect(result.data.recommendations.length).toBeGreaterThan(0)
    })

    it('includes cost of living in prompt when provided', async () => {
      getMockCreate().mockResolvedValueOnce(
        createMockAnthropicResponse(
          JSON.stringify(MOCK_COMPENSATION_ANALYSIS),
        ),
      )

      await client.generateCompensationAnalysis({
        companyName: 'Apple Inc.',
        execComp: [{ executiveName: 'Tim Cook', totalCompensation: 6300000000 }],
        userPay: 8500000,
        costOfLiving: {
          rentMortgage: 250000,
          utilities: 20000,
          groceries: 80000,
        },
      })

      const userMsg = getMockCreate().mock.calls[0][0].messages[0].content
      expect(userMsg).toContain('monthly expenses')
      expect(userMsg).toContain('rentMortgage')
    })

    it('works without optional params', async () => {
      getMockCreate().mockResolvedValueOnce(
        createMockAnthropicResponse(
          JSON.stringify(MOCK_COMPENSATION_ANALYSIS),
        ),
      )

      const result = await client.generateCompensationAnalysis({
        companyName: 'Tesla Inc.',
        execComp: [{ executiveName: 'Elon Musk', totalCompensation: 0 }],
      })

      expect(result.data.fairness_score).toBe(42)
      const userMsg = getMockCreate().mock.calls[0][0].messages[0].content
      expect(userMsg).not.toContain('monthly expenses')
      expect(userMsg).not.toContain('earns $')
    })
  })

  // ─── generateEmbedding ──────────────────────────────────────────────

  describe('generateEmbedding', () => {
    it('calls OpenAI embeddings API and returns 1536-dim vector', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ embedding: MOCK_EMBEDDING }],
            usage: { total_tokens: 42 },
          }),
      })
      globalThis.fetch = mockFetch

      const embedding = await client.generateEmbedding({
        text: 'Apple reported strong quarterly results',
      })

      expect(embedding).toHaveLength(1536)
      expect(mockFetch).toHaveBeenCalledOnce()

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.openai.com/v1/embeddings')
      expect(options.method).toBe('POST')

      const body = JSON.parse(options.body as string)
      expect(body.model).toBe('text-embedding-3-small')
      expect(body.dimensions).toBe(1536)
      expect(body.input).toContain('Apple')

      const headers = options.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer test-openai-key')
    })

    it('throws on OpenAI API errors', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid API key'),
      })

      await expect(
        client.generateEmbedding({ text: 'test' }),
      ).rejects.toThrow('OpenAI embeddings API error 401')
    })
  })

  // ─── ragQuery ───────────────────────────────────────────────────────

  describe('ragQuery', () => {
    it('sends context chunks and query to Claude', async () => {
      const answer =
        "Based on Apple's 10-K filing, the company earned $394 billion in revenue last year."
      getMockCreate().mockResolvedValueOnce(
        createMockAnthropicResponse(answer),
      )

      const result = await client.ragQuery({
        query: 'How much revenue did Apple make?',
        context: [
          'Apple reported total net revenue of $394.3 billion for fiscal year 2024.',
          'Services revenue grew 14% to $85.2 billion.',
        ],
      })

      expect(result.data).toContain('$394 billion')

      const call = getMockCreate().mock.calls[0][0]
      expect(call.system).toContain('Union')
      expect(call.system).toContain('SEC filings')
      expect(call.messages[0].content).toContain('[Source 1]')
      expect(call.messages[0].content).toContain('[Source 2]')
      expect(call.messages[0].content).toContain(
        'How much revenue did Apple make?',
      )
    })
  })

  // ─── Token usage tracking ──────────────────────────────────────────

  describe('token usage', () => {
    it('returns accurate token counts from API response', async () => {
      getMockCreate().mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Short answer' }],
        usage: { input_tokens: 500, output_tokens: 50 },
      })

      const result = await client.summarizeSection({
        section: 'Short section',
        sectionType: 'businessOverview',
        companyName: 'Test Corp',
        filingType: '10-K',
      })

      expect(result.usage).toEqual({
        inputTokens: 500,
        outputTokens: 50,
      })
    })
  })
})
