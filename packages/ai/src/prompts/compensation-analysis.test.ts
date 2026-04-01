import { describe, it, expect } from 'vitest'
import {
  compensationAnalysisSystemPrompt,
  compensationAnalysisUserPrompt,
} from './compensation-analysis'

describe('compensation analysis prompts', () => {
  describe('systemPrompt', () => {
    it('includes JSON schema instructions', () => {
      const prompt = compensationAnalysisSystemPrompt()
      expect(prompt).toContain('fairness_score')
      expect(prompt).toContain('explanation')
      expect(prompt).toContain('comparisons')
      expect(prompt).toContain('recommendations')
    })

    it('includes scoring guide', () => {
      const prompt = compensationAnalysisSystemPrompt()
      expect(prompt).toContain('80-100')
      expect(prompt).toContain('1-19')
    })

    it('mentions CEO-to-worker pay ratio benchmark', () => {
      const prompt = compensationAnalysisSystemPrompt()
      expect(prompt).toContain('272:1')
    })
  })

  describe('userPrompt', () => {
    it('includes company name and exec comp data', () => {
      const prompt = compensationAnalysisUserPrompt({
        companyName: 'Acme Inc',
        execComp: '[{"name":"CEO","totalCompensation":25000000}]',
      })

      expect(prompt).toContain('Acme Inc')
      expect(prompt).toContain('CEO')
      expect(prompt).toContain('25000000')
    })

    it('includes user pay when provided', () => {
      const prompt = compensationAnalysisUserPrompt({
        companyName: 'Test Corp',
        execComp: '[]',
        userPay: 8_500_000,
      })

      expect(prompt).toContain('85,000')
    })

    it('includes cost of living when provided', () => {
      const prompt = compensationAnalysisUserPrompt({
        companyName: 'Test Corp',
        execComp: '[]',
        costOfLiving: {
          rentMortgage: 200_000,
          groceries: 60_000,
          other: null,
        },
      })

      expect(prompt).toContain('rentMortgage')
      expect(prompt).toContain('2,000')
    })

    it('omits cost of living section when empty', () => {
      const prompt = compensationAnalysisUserPrompt({
        companyName: 'Test Corp',
        execComp: '[]',
        costOfLiving: {},
      })

      expect(prompt).not.toContain('monthly expenses')
    })

    it('includes company financials when provided', () => {
      const prompt = compensationAnalysisUserPrompt({
        companyName: 'Test Corp',
        execComp: '[]',
        companyFinancials: '{"revenue": 10000000000}',
      })

      expect(prompt).toContain('Company financial data')
      expect(prompt).toContain('revenue')
    })
  })
})
