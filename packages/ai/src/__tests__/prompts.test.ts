import { describe, expect, it } from 'vitest'
import {
  filingSummarySystemPrompt,
  filingSummaryUserPrompt,
} from '../prompts/filing-summary'
import {
  sectionSummarySystemPrompt,
  sectionSummaryUserPrompt,
} from '../prompts/section-summary'
import {
  compensationAnalysisSystemPrompt,
  compensationAnalysisUserPrompt,
} from '../prompts/compensation-analysis'
import { ragAnswerSystemPrompt, ragAnswerUserPrompt } from '../prompts/rag-answer'

describe('filing-summary prompts', () => {
  it('system prompt contains output JSON structure', () => {
    const prompt = filingSummarySystemPrompt()
    expect(prompt).toContain('executive_summary')
    expect(prompt).toContain('key_numbers')
    expect(prompt).toContain('red_flags')
    expect(prompt).toContain('opportunities')
    expect(prompt).toContain('employee_relevance')
    expect(prompt).toContain('plain_language_explanation')
  })

  it('system prompt targets non-finance audience', () => {
    const prompt = filingSummarySystemPrompt()
    expect(prompt).toContain('NOT finance professionals')
  })

  it('user prompt includes company name, filing type, and data', () => {
    const prompt = filingSummaryUserPrompt({
      companyName: 'Tesla Inc.',
      filingType: '10-K',
      rawData: '{"revenue": 81000000000}',
    })
    expect(prompt).toContain('Tesla Inc.')
    expect(prompt).toContain('10-K')
    expect(prompt).toContain('81000000000')
  })
})

describe('section-summary prompts', () => {
  it('uses section-specific guidance for riskFactors', () => {
    const prompt = sectionSummarySystemPrompt('riskFactors')
    expect(prompt).toContain('Job security')
    expect(prompt).toContain('riskFactors')
  })

  it('uses section-specific guidance for mdAndA', () => {
    const prompt = sectionSummarySystemPrompt('mdAndA')
    expect(prompt).toContain('Cash flow')
    expect(prompt).toContain('revenue')
  })

  it('uses section-specific guidance for businessOverview', () => {
    const prompt = sectionSummarySystemPrompt('businessOverview')
    expect(prompt).toContain('products/services')
    expect(prompt).toContain('competitors')
  })

  it('uses section-specific guidance for executiveCompensation', () => {
    const prompt = sectionSummarySystemPrompt('executiveCompensation')
    expect(prompt).toContain('CEO pay')
    expect(prompt).toContain('median worker pay')
  })

  it('falls back to generic guidance for unknown sections', () => {
    const prompt = sectionSummarySystemPrompt('unknownSection')
    expect(prompt).toContain('plain language')
    expect(prompt).toContain('unknownSection')
  })

  it('user prompt includes all parameters', () => {
    const prompt = sectionSummaryUserPrompt({
      section: 'The company faces risks from...',
      sectionType: 'riskFactors',
      companyName: 'Apple Inc.',
      filingType: '10-K',
    })
    expect(prompt).toContain('Apple Inc.')
    expect(prompt).toContain('10-K')
    expect(prompt).toContain('riskFactors')
    expect(prompt).toContain('company faces risks')
  })
})

describe('compensation-analysis prompts', () => {
  it('system prompt contains output JSON structure', () => {
    const prompt = compensationAnalysisSystemPrompt()
    expect(prompt).toContain('fairness_score')
    expect(prompt).toContain('comparisons')
    expect(prompt).toContain('recommendations')
    expect(prompt).toContain('1-100')
  })

  it('system prompt references S&P 500 median pay ratio', () => {
    const prompt = compensationAnalysisSystemPrompt()
    expect(prompt).toContain('272:1')
  })

  it('user prompt includes exec comp data', () => {
    const prompt = compensationAnalysisUserPrompt({
      companyName: 'Apple Inc.',
      execComp: '[{"name": "Tim Cook", "total": 63000000}]',
    })
    expect(prompt).toContain('Apple Inc.')
    expect(prompt).toContain('Tim Cook')
  })

  it('user prompt includes user pay when provided', () => {
    const prompt = compensationAnalysisUserPrompt({
      companyName: 'Apple Inc.',
      execComp: '[]',
      userPay: 8500000,
    })
    expect(prompt).toContain('$85,000')
  })

  it('user prompt includes cost of living when provided', () => {
    const prompt = compensationAnalysisUserPrompt({
      companyName: 'Apple Inc.',
      execComp: '[]',
      costOfLiving: { rentMortgage: 250000, groceries: 80000, gym: null },
    })
    expect(prompt).toContain('monthly expenses')
    expect(prompt).toContain('rentMortgage')
    expect(prompt).toContain('groceries')
    // null values should be filtered out
    expect(prompt).not.toContain('gym')
  })

  it('user prompt omits optional sections when not provided', () => {
    const prompt = compensationAnalysisUserPrompt({
      companyName: 'Test Corp',
      execComp: '[]',
    })
    expect(prompt).not.toContain('monthly expenses')
    expect(prompt).not.toContain('earns $')
    expect(prompt).not.toContain('financial data')
  })
})

describe('rag-answer prompts', () => {
  it('system prompt sets Union context', () => {
    const prompt = ragAnswerSystemPrompt()
    expect(prompt).toContain('Union')
    expect(prompt).toContain('SEC filings')
    expect(prompt).toContain('never make up financial data')
  })

  it('system prompt prohibits investment advice', () => {
    const prompt = ragAnswerSystemPrompt()
    expect(prompt).toContain('Never give investment advice')
  })

  it('user prompt numbers context sources', () => {
    const prompt = ragAnswerUserPrompt({
      query: 'What is the revenue?',
      context: ['Revenue was $100B', 'Profit was $25B'],
    })
    expect(prompt).toContain('[Source 1]')
    expect(prompt).toContain('[Source 2]')
    expect(prompt).toContain('Revenue was $100B')
    expect(prompt).toContain('What is the revenue?')
  })
})
