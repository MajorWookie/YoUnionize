import { describe, expect, it } from 'vitest'
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
import {
  businessOverviewSummarySystemPrompt,
  businessOverviewSummaryUserPrompt,
} from '../prompts/business-overview'
import {
  riskFactorsSummarySystemPrompt,
  riskFactorsSummaryUserPrompt,
} from '../prompts/risk-factors'
import {
  legalProceedingsSummarySystemPrompt,
  legalProceedingsSummaryUserPrompt,
} from '../prompts/legal-proceedings'
import {
  financialFootnotesSummarySystemPrompt,
  financialFootnotesSummaryUserPrompt,
} from '../prompts/financial-footnotes'
import {
  executiveCompensationSummarySystemPrompt,
  executiveCompensationSummaryUserPrompt,
} from '../prompts/executive-compensation'
import {
  cybersecuritySummarySystemPrompt,
  cybersecuritySummaryUserPrompt,
} from '../prompts/cybersecurity'
import {
  controlsAndProceduresSummarySystemPrompt,
  controlsAndProceduresSummaryUserPrompt,
} from '../prompts/controls-and-procedures'
import {
  relatedTransactionsSummarySystemPrompt,
  relatedTransactionsSummaryUserPrompt,
} from '../prompts/related-transactions'
import {
  proxySummarySystemPrompt,
  proxySummaryUserPrompt,
} from '../prompts/proxy'
import {
  event8kSummarySystemPrompt,
  event8kSummaryUserPrompt,
} from '../prompts/event-8k'
import {
  narrativeSummarySystemPrompt,
  narrativeSummaryUserPrompt,
} from '../prompts/narrative'
import {
  mdaSummarySystemPrompt,
  mdaSummaryUserPrompt,
} from '../prompts/mda-summary'
import { scaffoldSystemPrompt } from '../prompts/_scaffold'

// ─── Per-section dedicated prompt content checks ─────────────────────────
//
// All 12 per-section modules use the shared `_scaffold.ts` helpers:
// `scaffoldSystemPrompt({ guidance, maxWords?, outputFormat?, requiredSections? })`
// and `scaffoldUserPrompt({sectionLabel, ...})`.
//
// 11 modules pass only `guidance`, getting the default `outputFormat: 'plain'`
// and `maxWords: 150`. MDA passes `outputFormat: 'structured-markdown'` with
// `requiredSections` to declare its 6-section breakdown and `maxWords: 500`.
//
// These tests assert the scaffold contract: each per-section module's
// system prompt contains its GUIDANCE keyword + the shared persona/rules,
// each user prompt embeds the human-readable section label + the
// XML-wrapped source text, and MDA additionally produces structured-markdown
// output rules with all 6 required `## Heading` blocks.

describe('business-overview dedicated prompt', () => {
  it('system prompt contains the businessOverview-specific guidance + shared rules', () => {
    const prompt = businessOverviewSummarySystemPrompt()
    expect(prompt).toContain('financial translator')
    expect(prompt).toContain('products/services')
    expect(prompt).toContain('competitors')
    expect(prompt).toContain('6th-grade reading level')
  })

  it('user prompt embeds company, filing type, section label, and XML-wrapped content', () => {
    const prompt = businessOverviewSummaryUserPrompt({
      section: 'Acme Corp designs and sells widgets to consumers worldwide.',
      companyName: 'Acme Corp',
      filingType: '10-K',
    })
    expect(prompt).toContain('Acme Corp')
    expect(prompt).toContain('10-K')
    expect(prompt).toContain('Business Overview')
    expect(prompt).toContain('<sec_filing_section>')
    expect(prompt).toContain('</sec_filing_section>')
    expect(prompt).toContain('designs and sells widgets')
    expect(prompt).toContain('Write your summary now.')
  })
})

describe('narrative dedicated prompt (catch-all for unmapped section codes)', () => {
  it('system prompt uses the generic guidance + shared rules', () => {
    const prompt = narrativeSummarySystemPrompt()
    expect(prompt).toContain('financial translator')
    expect(prompt).toContain('Summarize this section in plain language')
    expect(prompt).toContain('6th-grade reading level')
  })

  it('user prompt embeds company, filing type, and XML-wrapped content', () => {
    const prompt = narrativeSummaryUserPrompt({
      section: 'Some long-tail SEC item content.',
      companyName: 'Acme Corp',
      filingType: '10-K',
    })
    expect(prompt).toContain('Acme Corp')
    expect(prompt).toContain('10-K')
    expect(prompt).toContain('Filing')
    expect(prompt).toContain('<sec_filing_section>')
    expect(prompt).toContain('Some long-tail SEC item content.')
  })
})

describe.each([
  {
    kind: 'risk_factors',
    label: 'Risk Factors',
    system: riskFactorsSummarySystemPrompt,
    user: riskFactorsSummaryUserPrompt,
    contentCheck: 'Job security risks',
  },
  {
    kind: 'legal_proceedings',
    label: 'Legal Proceedings',
    system: legalProceedingsSummarySystemPrompt,
    user: legalProceedingsSummaryUserPrompt,
    contentCheck: 'lawsuits and legal issues',
  },
  {
    kind: 'financial_footnotes',
    label: 'Financial Statements',
    system: financialFootnotesSummarySystemPrompt,
    user: financialFootnotesSummaryUserPrompt,
    contentCheck: 'Break down the financial statements',
  },
  {
    kind: 'executive_compensation',
    label: 'Executive Compensation',
    system: executiveCompensationSummarySystemPrompt,
    user: executiveCompensationSummaryUserPrompt,
    contentCheck: 'CEO pay vs. median worker pay',
  },
  {
    kind: 'cybersecurity',
    label: 'Cybersecurity',
    system: cybersecuritySummarySystemPrompt,
    user: cybersecuritySummaryUserPrompt,
    contentCheck: 'Summarize this section in plain language',
  },
  {
    kind: 'controls_and_procedures',
    label: 'Controls and Procedures',
    system: controlsAndProceduresSummarySystemPrompt,
    user: controlsAndProceduresSummaryUserPrompt,
    contentCheck: 'Summarize this section in plain language',
  },
  {
    kind: 'related_transactions',
    label: 'Related Party Transactions',
    system: relatedTransactionsSummarySystemPrompt,
    user: relatedTransactionsSummaryUserPrompt,
    contentCheck: 'Summarize this section in plain language',
  },
  {
    kind: 'proxy',
    label: 'Proxy Statement',
    system: proxySummarySystemPrompt,
    user: proxySummaryUserPrompt,
    contentCheck: 'Summarize this section in plain language',
  },
  {
    kind: 'event_8k',
    label: 'Event',
    system: event8kSummarySystemPrompt,
    user: event8kSummaryUserPrompt,
    contentCheck: 'Summarize this 8-K event',
  },
])(
  'dedicated $kind prompt module',
  ({ label, system, user, contentCheck }) => {
    it('system prompt embeds the GUIDANCE content + shared persona + shared rules', () => {
      const prompt = system()
      expect(prompt).toContain('financial translator')
      expect(prompt).toContain(contentCheck)
      expect(prompt).toContain('6th-grade reading level')
    })

    it('user prompt embeds company, filing type, section label, and XML-wrapped content', () => {
      const prompt = user({
        section: 'Lorem ipsum sample section content for assertion.',
        companyName: 'Acme Corp',
        filingType: '10-K',
      })
      expect(prompt).toContain('Acme Corp')
      expect(prompt).toContain('10-K')
      expect(prompt).toContain(label)
      expect(prompt).toContain('<sec_filing_section>')
      expect(prompt).toContain('</sec_filing_section>')
      expect(prompt).toContain('Lorem ipsum sample section content')
      expect(prompt).toContain('Write your summary now.')
    })
  },
)

describe('mda dedicated prompt (structured-markdown override)', () => {
  it('system prompt contains MDA-specific guidance + universal rules', () => {
    const prompt = mdaSummarySystemPrompt()
    expect(prompt).toContain('financial translator')
    expect(prompt).toContain('Management Discussion & Analysis')
    expect(prompt).toContain('right-sizing')
    expect(prompt).toContain('6th-grade reading level')
  })

  it('system prompt declares all 6 required `## Heading` sections in order', () => {
    const prompt = mdaSummarySystemPrompt()
    expect(prompt).toContain('## The Big Picture')
    expect(prompt).toContain('## Revenue & Growth')
    expect(prompt).toContain('## Profitability')
    expect(prompt).toContain('## Cash & Spending')
    expect(prompt).toContain("## Management's Outlook")
    expect(prompt).toContain('## Bottom Line for Workers')

    // Heading order must match REQUIRED_SECTIONS in mda-summary.ts
    const headings = [
      '## The Big Picture',
      '## Revenue & Growth',
      '## Profitability',
      '## Cash & Spending',
      "## Management's Outlook",
      '## Bottom Line for Workers',
    ]
    let lastIdx = -1
    for (const h of headings) {
      const idx = prompt.indexOf(h)
      expect(idx).toBeGreaterThan(lastIdx)
      lastIdx = idx
    }
  })

  it('system prompt overrides the plain-text rule with structured-markdown rules', () => {
    const prompt = mdaSummarySystemPrompt()
    // Default 'plain' output rule must NOT appear.
    expect(prompt).not.toContain('Format your response as plain text only')
    // Structured-markdown output rule must appear.
    expect(prompt).toContain('Respond in markdown')
    expect(prompt).toContain('Not discussed in this filing')
  })

  it('system prompt uses the MDA-specific 500-word cap, not the default 150', () => {
    const prompt = mdaSummarySystemPrompt()
    expect(prompt).toContain('500 words')
    expect(prompt).not.toContain('under 150 words')
  })

  it('user prompt embeds section label, XML-wrapped content, and closer', () => {
    const prompt = mdaSummaryUserPrompt({
      section: 'Revenue grew 12% year-over-year driven by services.',
      companyName: 'Apple Inc.',
      filingType: '10-K',
    })
    expect(prompt).toContain('Apple Inc.')
    expect(prompt).toContain('10-K')
    expect(prompt).toContain('Management Discussion & Analysis')
    expect(prompt).toContain('<sec_filing_section>')
    expect(prompt).toContain('</sec_filing_section>')
    expect(prompt).toContain('Revenue grew 12%')
    expect(prompt).toContain('Write your summary now.')
  })
})

describe('event_8k dedicated prompt (json override)', () => {
  it('system prompt drops the plain-text rule in favour of JSON output rules', () => {
    const prompt = event8kSummarySystemPrompt()
    expect(prompt).not.toContain('Format your response as plain text only')
    expect(prompt).toContain('Respond with a single JSON object')
    expect(prompt).toContain('headline')
    expect(prompt).toContain('summary')
  })

  it('system prompt asks for an action-led headline and a 2-3 sentence body', () => {
    const prompt = event8kSummarySystemPrompt()
    expect(prompt).toContain('action-led')
    expect(prompt).toMatch(/2-3 sentences?/)
  })
})

describe('scaffoldSystemPrompt validation', () => {
  it('throws when outputFormat is structured-markdown but requiredSections is omitted', () => {
    expect(() =>
      scaffoldSystemPrompt({
        guidance: 'Test guidance.',
        outputFormat: 'structured-markdown',
      }),
    ).toThrow(/requiredSections/)
  })

  it('throws when outputFormat is json but jsonShape is omitted', () => {
    expect(() =>
      scaffoldSystemPrompt({
        guidance: 'Test guidance.',
        outputFormat: 'json',
      }),
    ).toThrow(/jsonShape/)
  })

  it('throws when outputFormat is structured-markdown and requiredSections is empty', () => {
    expect(() =>
      scaffoldSystemPrompt({
        guidance: 'Test guidance.',
        outputFormat: 'structured-markdown',
        requiredSections: [],
      }),
    ).toThrow(/requiredSections/)
  })

  it('emits the default 150-word cap when maxWords is omitted', () => {
    const prompt = scaffoldSystemPrompt({ guidance: 'Test guidance.' })
    expect(prompt).toContain('under 150 words')
  })

  it('honors a custom maxWords value in the plain output rule', () => {
    const prompt = scaffoldSystemPrompt({ guidance: 'Test.', maxWords: 75 })
    expect(prompt).toContain('under 75 words')
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
      userPayDollars: 85_000,
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

  it('user prompt formats user pay verbatim from raw dollars (no /100 conversion)', () => {
    const prompt = compensationAnalysisUserPrompt({
      userPayDollars: 85_000,
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
      userPayDollars: 50_000,
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
      userPayDollars: 50_000,
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
