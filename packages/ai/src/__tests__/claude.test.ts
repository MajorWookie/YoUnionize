import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaudeClient } from '../claude'
import type { CompensationFairnessResult } from '../prompts/compensation-analysis'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_COMPENSATION_ANALYSIS: CompensationFairnessResult = {
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
    'Research market rates for your role on levels.fyi or Glassdoor',
    "Apple's stock compensation may offset the base salary gap — review your total comp package",
  ],
}

const MOCK_EMBEDDING = Array.from({ length: 1024 }, (_, i) =>
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
      voyageApiKey: 'test-voyage-key',
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
        createMockAnthropicResponse('Summary of risk factors section'),
      )

      await client.summarizeSection({
        section: 'The Company faces several risks...',
        sectionType: 'riskFactors',
        companyName: 'Tesla Inc.',
        filingType: '10-K',
      })

      const systemPrompt = getMockCreate().mock.calls[0][0].system
      expect(systemPrompt).toContain('riskFactors')
      expect(systemPrompt).toContain('Job security')
    })
  })

  // ─── generateCompensationAnalysis ───────────────────────────────────

  describe('generateCompensationAnalysis', () => {
    it('returns parsed CompensationFairnessResult', async () => {
      getMockCreate().mockResolvedValueOnce(
        createMockAnthropicResponse(
          JSON.stringify(MOCK_COMPENSATION_ANALYSIS),
        ),
      )

      const result = await client.generateCompensationAnalysis({
        companyName: 'Apple Inc.',
        companyTicker: 'AAPL',
        companySector: 'Technology',
        execComp: [
          { executiveName: 'Tim Cook', totalCompensation: 6300000000 },
        ],
        userPayCents: 8500000, // $85,000 in cents
      })

      expect(result.data.fairness_score).toBe(42)
      expect(result.data.explanation).toContain('672 times')
      expect(result.data.comparisons.length).toBeGreaterThan(0)
      expect(result.data.recommendations.length).toBeGreaterThan(0)
    })

    it('embeds cost-of-living, exec-comp and financials in the prompt', async () => {
      getMockCreate().mockResolvedValueOnce(
        createMockAnthropicResponse(
          JSON.stringify(MOCK_COMPENSATION_ANALYSIS),
        ),
      )

      await client.generateCompensationAnalysis({
        companyName: 'Apple Inc.',
        companyTicker: 'AAPL',
        execComp: [{ executiveName: 'Tim Cook', totalCompensation: 6300000000 }],
        userPayCents: 8500000,
        costOfLiving: {
          rentMortgage: 250000,
          utilities: 20000,
          groceries: 80000,
        },
        companyFinancials: { revenue: 394000000000 },
      })

      const userMsg = getMockCreate().mock.calls[0][0].messages[0].content
      expect(userMsg).toContain('Cost of Living')
      expect(userMsg).toContain('rentMortgage')
      expect(userMsg).toContain('Company Financials')
      expect(userMsg).toContain('Tim Cook')
      expect(userMsg).toContain('Employee Pay: $85,000/year')
    })
  })

  // ─── generateEmbedding ──────────────────────────────────────────────

  describe('generateEmbedding', () => {
    it('calls Voyage AI embeddings API and returns 1024-dim vector', async () => {
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

      expect(embedding).toHaveLength(1024)
      expect(mockFetch).toHaveBeenCalledOnce()

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.voyageai.com/v1/embeddings')
      expect(options.method).toBe('POST')

      const body = JSON.parse(options.body as string)
      expect(body.model).toBe('voyage-4-lite')
      expect(body.output_dimension).toBe(1024)
      expect(body.input_type).toBe('document')
      expect(body.input).toContain('Apple')

      const headers = options.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer test-voyage-key')
    })

    it('passes input_type query for search embeddings', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ embedding: MOCK_EMBEDDING }],
            usage: { total_tokens: 10 },
          }),
      })

      await client.generateEmbedding({
        text: 'What is Apple revenue?',
        inputType: 'query',
      })

      const body = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
      )
      expect(body.input_type).toBe('query')
    })

    it('throws on Voyage AI API errors', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid API key'),
      })

      await expect(
        client.generateEmbedding({ text: 'test' }),
      ).rejects.toThrow('Voyage AI embeddings error 401')
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
          '[AAPL 10-K — financial_footnotes (2024-09-28)]\nApple reported total net revenue of $394.3 billion for fiscal year 2024.',
          '[AAPL 10-K — mda (2024-09-28)]\nServices revenue grew 14% to $85.2 billion.',
        ],
      })

      expect(result.data).toContain('$394 billion')

      const call = getMockCreate().mock.calls[0][0]
      expect(call.system).toContain('YoUnionize')
      expect(call.system).toContain('SEC filings')
      // Production: chunks arrive pre-labeled and are joined with '---' separators;
      // no [Source N] numbering is added.
      expect(call.messages[0].content).toContain('Context from SEC filings:')
      expect(call.messages[0].content).toContain('[AAPL 10-K — financial_footnotes')
      expect(call.messages[0].content).toContain('---')
      expect(call.messages[0].content).toContain(
        'Question: How much revenue did Apple make?',
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
