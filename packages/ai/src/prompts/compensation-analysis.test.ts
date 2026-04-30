import { describe, it, expect } from 'vitest'
import {
  compensationAnalysisSystemPrompt,
  compensationAnalysisUserPrompt,
} from './compensation-analysis'

describe('compensation analysis prompts', () => {
  describe('systemPrompt', () => {
    it('declares the 1-100 JSON contract that matches the AnalysisData frontend type', () => {
      const prompt = compensationAnalysisSystemPrompt()
      expect(prompt).toContain('1-100')
      expect(prompt).toContain('fairness_score')
      expect(prompt).toContain('explanation')
      expect(prompt).toContain('comparisons')
      expect(prompt).toContain('recommendations')
    })

    it('includes a banded scoring guide so 1-100 outputs are calibrated', () => {
      const prompt = compensationAnalysisSystemPrompt()
      expect(prompt).toContain('80-100')
      expect(prompt).toContain('60-79')
      expect(prompt).toContain('40-59')
      expect(prompt).toContain('20-39')
      expect(prompt).toContain('1-19')
    })

    it('names the five expected comparisons', () => {
      const prompt = compensationAnalysisSystemPrompt()
      expect(prompt).toContain('CEO-to-worker pay ratio')
      expect(prompt).toContain('revenue-per-employee')
      expect(prompt).toContain('median worker pay')
      expect(prompt).toContain('stock awards')
      expect(prompt).toContain('cost of living')
    })

    it('frames the model as a compensation fairness analyst', () => {
      const prompt = compensationAnalysisSystemPrompt()
      expect(prompt).toContain('compensation fairness analyst')
    })
  })

  describe('userPrompt', () => {
    it('includes company name, ticker, and exec comp data', () => {
      const prompt = compensationAnalysisUserPrompt({
        userPayCents: 8_500_000,
        userJobTitle: null,
        companyName: 'Acme Inc',
        companyTicker: 'ACME',
        companySector: 'Industrials',
        execComp: [{ name: 'CEO', totalCompensation: 25000000 }],
        companyFinancials: {},
        costOfLiving: {},
      })

      expect(prompt).toContain('Acme Inc')
      expect(prompt).toContain('ACME')
      expect(prompt).toContain('Industrials')
      expect(prompt).toContain('"totalCompensation": 25000000')
    })

    it('formats user pay in dollars from the cents input', () => {
      const prompt = compensationAnalysisUserPrompt({
        userPayCents: 8_500_000,
        companyName: 'Test Corp',
        companyTicker: 'TEST',
        execComp: [],
        companyFinancials: {},
        costOfLiving: {},
      })

      expect(prompt).toContain('Employee Pay: $85,000/year')
    })

    it('falls back to "Not specified" / "Unknown" for missing optional fields', () => {
      const prompt = compensationAnalysisUserPrompt({
        userPayCents: 5_000_000,
        companyName: 'Test Corp',
        companyTicker: 'TEST',
        execComp: [],
        companyFinancials: {},
        costOfLiving: {},
      })

      expect(prompt).toContain('Job Title: Not specified')
      expect(prompt).toContain('Sector: Unknown')
    })

    it('embeds cost of living and company financials as JSON blocks', () => {
      const prompt = compensationAnalysisUserPrompt({
        userPayCents: 5_000_000,
        companyName: 'Test Corp',
        companyTicker: 'TEST',
        execComp: [],
        companyFinancials: { revenue: 10_000_000_000 },
        costOfLiving: { rentMortgage: 200_000, groceries: 60_000, other: null },
      })

      expect(prompt).toContain('Cost of Living')
      expect(prompt).toContain('rentMortgage')
      expect(prompt).toContain('Company Financials')
      expect(prompt).toContain('"revenue": 10000000000')
    })
  })
})
