import { describe, expect, it } from 'vitest'
import {
  sectionSummarySystemPrompt,
  sectionSummaryUserPrompt,
} from '../prompts/section-summary'
import {
  compensationAnalysisSystemPrompt,
  compensationAnalysisUserPrompt,
} from '../prompts/compensation-analysis'
import { ragAnswerSystemPrompt, ragAnswerUserPrompt } from '../prompts/rag-answer'
import {
  companySummarySystemPrompt,
  companySummaryUserPrompt,
} from '../prompts/company-summary'
import {
  employeeImpactSystemPrompt,
  employeeImpactUserPrompt,
} from '../prompts/employee-impact'
import {
  workforceSignalsSystemPrompt,
  workforceSignalsUserPrompt,
} from '../prompts/workforce-signals'

describe('section-summary prompts', () => {
  it('uses section-specific guidance for riskFactors', () => {
    const prompt = sectionSummarySystemPrompt('riskFactors')
    expect(prompt).toContain('Job security')
    expect(prompt).toContain('riskFactors')
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

describe('compensation-analysis prompts (1-100 banded contract)', () => {
  it('system prompt declares the JSON output structure', () => {
    const prompt = compensationAnalysisSystemPrompt()
    expect(prompt).toContain('fairness_score')
    expect(prompt).toContain('explanation')
    expect(prompt).toContain('comparisons')
    expect(prompt).toContain('recommendations')
    expect(prompt).toContain('1-100')
  })

  it('system prompt includes the banded scoring guide', () => {
    const prompt = compensationAnalysisSystemPrompt()
    expect(prompt).toContain('80-100')
    expect(prompt).toContain('1-19')
  })

  it('system prompt references the S&P 500 CEO pay ratio benchmark', () => {
    const prompt = compensationAnalysisSystemPrompt()
    expect(prompt).toContain('272:1')
  })

  it('system prompt sets a supportive-but-empowering tone', () => {
    const prompt = compensationAnalysisSystemPrompt()
    expect(prompt).toContain('supportive and empowering')
    expect(prompt).toContain('manufacturing outrage')
  })

  it('user prompt includes exec comp, ticker, and sector', () => {
    const prompt = compensationAnalysisUserPrompt({
      userPayCents: 8_500_000,
      userJobTitle: 'Engineer',
      companyName: 'Apple Inc.',
      companyTicker: 'AAPL',
      companySector: 'Technology',
      execComp: [{ name: 'Tim Cook', total: 63000000 }],
      companyFinancials: {},
      costOfLiving: {},
    })
    expect(prompt).toContain('Apple Inc.')
    expect(prompt).toContain('AAPL')
    expect(prompt).toContain('Technology')
    expect(prompt).toContain('Tim Cook')
  })

  it('user prompt formats user pay as dollars from cents', () => {
    const prompt = compensationAnalysisUserPrompt({
      userPayCents: 8_500_000,
      companyName: 'Apple Inc.',
      companyTicker: 'AAPL',
      execComp: [],
      companyFinancials: {},
      costOfLiving: {},
    })
    expect(prompt).toContain('Employee Pay: $85,000/year')
  })

  it('user prompt embeds cost of living JSON when provided', () => {
    const prompt = compensationAnalysisUserPrompt({
      userPayCents: 5_000_000,
      companyName: 'Apple Inc.',
      companyTicker: 'AAPL',
      execComp: [],
      companyFinancials: {},
      costOfLiving: { rentMortgage: 250000, groceries: 80000, gym: null },
    })
    expect(prompt).toContain('Cost of Living')
    expect(prompt).toContain('rentMortgage')
    expect(prompt).toContain('groceries')
  })

  it('user prompt always emits all five sections (production behaviour)', () => {
    const prompt = compensationAnalysisUserPrompt({
      userPayCents: 5_000_000,
      companyName: 'Test Corp',
      companyTicker: 'TEST',
      execComp: [],
      companyFinancials: {},
      costOfLiving: {},
    })
    // Production never conditionally omits sections — empty objects render as `{}`.
    expect(prompt).toContain('Executive Compensation')
    expect(prompt).toContain('Company Financials')
    expect(prompt).toContain('Cost of Living')
  })
})

describe('company-summary prompts (aggregated input)', () => {
  it('system prompt frames input as pre-summarised, not raw', () => {
    const prompt = companySummarySystemPrompt()
    expect(prompt).toContain('PRE-SUMMARISED')
    expect(prompt).toContain('Trust the summaries')
  })

  it('system prompt declares the JSON output shape', () => {
    const prompt = companySummarySystemPrompt()
    expect(prompt).toContain('headline')
    expect(prompt).toContain('company_health')
    expect(prompt).toContain('key_numbers')
    expect(prompt).toContain('red_flags')
    expect(prompt).toContain('opportunities')
  })

  it('user prompt embeds aggregated sections + meta', () => {
    const prompt = companySummaryUserPrompt({
      companyName: 'Apple Inc.',
      filingType: '10-K',
      aggregatedSections: '## Risk Factors (Item 1A)\nApple faces supply chain risk.',
    })
    expect(prompt).toContain('Apple Inc.')
    expect(prompt).toContain('10-K')
    expect(prompt).toContain('Pre-summarised sections')
    expect(prompt).toContain('Apple faces supply chain risk')
  })
})

describe('employee-impact prompts (outlook only)', () => {
  it('system prompt strips workforce/visa concerns (handled by separate prompt)', () => {
    const prompt = employeeImpactSystemPrompt()
    expect(prompt).not.toContain('workforce_geography')
    expect(prompt).not.toContain('h1b_and_visa_dependency')
    expect(prompt).toContain('separate prompt')
  })

  it('system prompt declares the four outlook signal categories', () => {
    const prompt = employeeImpactSystemPrompt()
    expect(prompt).toContain('Job Security Signals')
    expect(prompt).toContain('Compensation & Benefits')
    expect(prompt).toContain('Growth & Opportunity')
    expect(prompt).toContain('Culture & Governance')
  })

  it('system prompt declares JSON output shape (outlook fields only)', () => {
    const prompt = employeeImpactSystemPrompt()
    expect(prompt).toContain('overall_outlook')
    expect(prompt).toContain('job_security')
    expect(prompt).toContain('compensation_signals')
    expect(prompt).toContain('growth_opportunities')
    expect(prompt).toContain('watch_items')
  })

  it('user prompt embeds aggregated sections', () => {
    const prompt = employeeImpactUserPrompt({
      companyName: 'Tesla Inc.',
      filingType: '10-K',
      aggregatedSections: '## Business Overview (Item 1)\nTesla designs and manufactures EVs.',
    })
    expect(prompt).toContain('Tesla Inc.')
    expect(prompt).toContain('10-K')
    expect(prompt).toContain('Pre-summarised sections')
    expect(prompt).toContain('Tesla designs and manufactures EVs')
  })
})

describe('workforce-signals prompts', () => {
  it('system prompt names the two specific signal categories', () => {
    const prompt = workforceSignalsSystemPrompt()
    expect(prompt).toContain('Workforce & Revenue Geography')
    expect(prompt).toContain('H-1B & Visa Dependency')
  })

  it('system prompt requires raw text and direct quotes', () => {
    const prompt = workforceSignalsSystemPrompt()
    expect(prompt).toContain('RAW section text')
    expect(prompt).toContain('quote')
  })

  it('system prompt declares JSON output shape', () => {
    const prompt = workforceSignalsSystemPrompt()
    expect(prompt).toContain('workforce_geography')
    expect(prompt).toContain('h1b_and_visa_dependency')
    expect(prompt).toContain('watch_items')
  })

  it('user prompt embeds both raw sections when present', () => {
    const prompt = workforceSignalsUserPrompt({
      companyName: 'Acme Corp',
      filingType: '10-K',
      businessOverview: 'Acme employs 5,000 in the US and 12,000 internationally.',
      riskFactors: 'Our business depends on the availability of H-1B visa workers.',
    })
    expect(prompt).toContain('Acme Corp')
    expect(prompt).toContain('Business Overview / Human Capital (raw text)')
    expect(prompt).toContain('Risk Factors (raw text)')
    expect(prompt).toContain('Acme employs 5,000')
    expect(prompt).toContain('H-1B visa workers')
  })

  it('user prompt notes when a section is missing', () => {
    const prompt = workforceSignalsUserPrompt({
      companyName: 'Acme Corp',
      filingType: '10-Q',
      businessOverview: null,
      riskFactors: 'Some risk.',
    })
    expect(prompt).toContain('(not present in this filing)')
    expect(prompt).toContain('Some risk.')
  })
})

describe('rag-answer prompts', () => {
  it('system prompt sets YoUnionize context', () => {
    const prompt = ragAnswerSystemPrompt()
    expect(prompt).toContain('YoUnionize')
    expect(prompt).toContain('SEC filings')
    expect(prompt).toContain('never make up financial data')
  })

  it('system prompt prohibits investment advice', () => {
    const prompt = ragAnswerSystemPrompt()
    expect(prompt).toContain('Never give investment advice')
  })

  it('user prompt joins pre-labeled context chunks with separators', () => {
    const prompt = ragAnswerUserPrompt({
      query: 'What is the revenue?',
      context: [
        '[AAPL 10-K — mda]\nRevenue was $100B',
        '[AAPL 10-K — financial_footnotes]\nProfit was $25B',
      ],
    })
    // Production: chunks arrive pre-labeled by the caller (ticker + filing
    // type + section); the prompt does NOT add [Source N] numbering on top.
    expect(prompt).toContain('Context from SEC filings:')
    expect(prompt).toContain('[AAPL 10-K — mda]')
    expect(prompt).toContain('---')
    expect(prompt).toContain('Revenue was $100B')
    expect(prompt).toContain('Question: What is the revenue?')
  })
})
