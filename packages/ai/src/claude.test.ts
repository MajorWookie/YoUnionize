import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClaudeClient } from './claude'

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn(),
      }
    },
  }
})

// Mock global fetch for embedding tests
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('ClaudeClient', () => {
  let client: ClaudeClient
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    client = new ClaudeClient({
      apiKey: 'test-key',
      openaiApiKey: 'test-openai-key',
    })
    // Access the mocked create function
    mockCreate = (client as unknown as { anthropic: { messages: { create: ReturnType<typeof vi.fn> } } }).anthropic.messages.create
  })

  describe('summarizeSection', () => {
    it('returns plain text summary', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'This section discusses key risk factors.' }],
        usage: { input_tokens: 500, output_tokens: 100 },
      })

      const result = await client.summarizeSection({
        section: 'Market volatility may affect our operations...',
        sectionType: 'risk_factors',
        companyName: 'Test Corp',
        filingType: '10-K',
      })

      expect(result.data).toContain('risk factors')
      expect(result.usage.inputTokens).toBe(500)
      expect(result.usage.outputTokens).toBe(100)
      expect(result.cached).toBe(false)
    })
  })

  describe('generateFilingSummary', () => {
    it('parses JSON response into FilingSummaryResult', async () => {
      const mockSummary = {
        executive_summary: 'Strong year',
        key_numbers: [{ label: 'Revenue', value: '$10B', context: 'Up 15%' }],
        plain_language_explanation: 'Company did well.',
        red_flags: [],
        opportunities: ['Market expansion'],
        employee_relevance: 'Hiring planned.',
      }

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockSummary) }],
        usage: { input_tokens: 2000, output_tokens: 500 },
      })

      const result = await client.generateFilingSummary({
        rawData: { revenue: 10_000_000_000 },
        filingType: '10-K',
        companyName: 'Test Corp',
      })

      expect(result.data.executive_summary).toBe('Strong year')
      expect(result.data.key_numbers).toHaveLength(1)
      expect(result.data.opportunities).toContain('Market expansion')
    })

    it('handles JSON wrapped in markdown code fences', async () => {
      const mockSummary = {
        executive_summary: 'Test',
        key_numbers: [],
        plain_language_explanation: 'Test',
        red_flags: [],
        opportunities: [],
        employee_relevance: 'Test',
      }

      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: '```json\n' + JSON.stringify(mockSummary) + '\n```' },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      const result = await client.generateFilingSummary({
        rawData: {},
        filingType: '10-K',
        companyName: 'Test',
      })

      expect(result.data.executive_summary).toBe('Test')
    })
  })

  describe('generateCompensationAnalysis', () => {
    it('returns fairness score and recommendations', async () => {
      const mockAnalysis = {
        fairness_score: 45,
        explanation: 'Below median for the industry.',
        comparisons: [
          { label: 'CEO Ratio', insight: '300:1 ratio vs. 272:1 median' },
        ],
        recommendations: ['Negotiate for equity.'],
      }

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 1500, output_tokens: 400 },
      })

      const result = await client.generateCompensationAnalysis({
        execComp: [{ name: 'CEO', totalCompensation: 25_000_000 }],
        userPay: 8_500_000,
        companyName: 'Test Corp',
      })

      expect(result.data.fairness_score).toBe(45)
      expect(result.data.recommendations).toHaveLength(1)
    })

    it('handles analysis without user pay', async () => {
      const mockAnalysis = {
        fairness_score: 50,
        explanation: 'Analysis without specific user context.',
        comparisons: [],
        recommendations: [],
      }

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 800, output_tokens: 200 },
      })

      const result = await client.generateCompensationAnalysis({
        execComp: [{ name: 'CEO', totalCompensation: 10_000_000 }],
        companyName: 'Test Corp',
      })

      expect(result.data.fairness_score).toBe(50)
    })
  })

  describe('generateEmbedding', () => {
    it('returns 1536-dimensional vector', async () => {
      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random())

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ embedding: mockEmbedding }],
            usage: { total_tokens: 15 },
          }),
      })

      const result = await client.generateEmbedding({ text: 'test query' })

      expect(result).toHaveLength(1536)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-openai-key',
          }),
        }),
      )
    })

    it('throws when OpenAI API key is missing', async () => {
      const clientNoKey = new ClaudeClient({ apiKey: 'test' })
      // Override the key to undefined
      Object.defineProperty(clientNoKey, 'openaiApiKey', { value: undefined })

      await expect(
        clientNoKey.generateEmbedding({ text: 'test' }),
      ).rejects.toThrow('OpenAI API key required')
    })

    it('throws on OpenAI API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      })

      await expect(
        client.generateEmbedding({ text: 'test' }),
      ).rejects.toThrow('OpenAI embeddings API error 429')
    })
  })

  describe('ragQuery', () => {
    it('returns answer based on context', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Based on the filing data, revenue grew 15% in 2024.',
          },
        ],
        usage: { input_tokens: 3000, output_tokens: 50 },
      })

      const result = await client.ragQuery({
        query: 'How did revenue change?',
        context: ['[TEST 10-K — income_statement] Revenue: $10.5B (2024) vs $9.1B (2023)'],
      })

      expect(result.data).toContain('revenue grew')
    })
  })

  describe('error handling', () => {
    it('throws on unexpected content block type', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: '1', name: 'test', input: {} }],
        usage: { input_tokens: 100, output_tokens: 0 },
      })

      await expect(
        client.summarizeSection({
          section: 'test',
          sectionType: 'test',
          companyName: 'Test',
          filingType: '10-K',
        }),
      ).rejects.toThrow('Unexpected content block type')
    })

    it('throws on invalid JSON in filing summary', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not valid json {{{' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      })

      await expect(
        client.generateFilingSummary({
          rawData: {},
          filingType: '10-K',
          companyName: 'Test',
        }),
      ).rejects.toThrow()
    })
  })
})
