/**
 * Tests for the compensation analysis math used in My Pay screen.
 * These calculations run client-side in my-pay/index.tsx but are critical to verify.
 */
import { describe, it, expect } from 'vitest'

// ── Tax rate estimation (from my-pay/index.tsx) ──────────────────────────

function estimateTaxRate(grossAnnualDollars: number): number {
  if (grossAnnualDollars <= 11_600) return 0.10
  if (grossAnnualDollars <= 47_150) return 0.12
  if (grossAnnualDollars <= 100_525) return 0.22
  if (grossAnnualDollars <= 191_950) return 0.24
  if (grossAnnualDollars <= 243_725) return 0.32
  if (grossAnnualDollars <= 609_350) return 0.35
  return 0.37
}

describe('compensation math', () => {
  describe('estimateTaxRate', () => {
    it('returns 10% for lowest bracket', () => {
      expect(estimateTaxRate(10_000)).toBe(0.10)
    })

    it('returns 12% for second bracket', () => {
      expect(estimateTaxRate(30_000)).toBe(0.12)
    })

    it('returns 22% for typical engineer salary', () => {
      expect(estimateTaxRate(85_000)).toBe(0.22)
    })

    it('returns 24% for senior roles', () => {
      expect(estimateTaxRate(150_000)).toBe(0.24)
    })

    it('returns 37% for top bracket', () => {
      expect(estimateTaxRate(1_000_000)).toBe(0.37)
    })

    it('returns correct rate at bracket boundaries', () => {
      expect(estimateTaxRate(11_600)).toBe(0.10)
      expect(estimateTaxRate(11_601)).toBe(0.12)
      expect(estimateTaxRate(47_150)).toBe(0.12)
      expect(estimateTaxRate(47_151)).toBe(0.22)
    })
  })

  describe('monthly budget breakdown', () => {
    it('calculates after-tax monthly income', () => {
      const grossAnnualPay = 8_500_000 // cents
      const grossAnnualDollars = grossAnnualPay / 100 // $85,000
      const monthlyIncome = grossAnnualDollars / 12
      const taxRate = estimateTaxRate(grossAnnualDollars)
      const afterTaxMonthly = monthlyIncome - monthlyIncome * taxRate

      expect(monthlyIncome).toBeCloseTo(7_083.33, 0)
      expect(taxRate).toBe(0.22)
      expect(afterTaxMonthly).toBeCloseTo(5_525, 0)
    })

    it('calculates net remaining after expenses', () => {
      const grossAnnual = 85_000
      const monthly = grossAnnual / 12
      const taxRate = 0.22
      const afterTax = monthly * (1 - taxRate)

      // Monthly expenses in dollars (from cost of living cents / 100)
      const rent = 2_000
      const groceries = 600
      const other = 300
      const totalExpenses = rent + groceries + other
      const savings = 500

      const netRemaining = afterTax - totalExpenses - savings

      expect(netRemaining).toBeCloseTo(afterTax - 3_400, 0)
      expect(netRemaining).toBeGreaterThan(0)
    })
  })

  describe('minimum viable salary calculation', () => {
    it('calculates pre-tax salary needed to cover costs', () => {
      const monthlyExpenses = 3_000
      const monthlySavings = 500
      const totalMonthlyCosts = monthlyExpenses + monthlySavings
      const taxRate = 0.22

      // Pre-tax salary needed = (costs * 12) / (1 - taxRate)
      const minimumViableSalary = (totalMonthlyCosts * 12) / (1 - taxRate)

      expect(minimumViableSalary).toBeCloseTo(53_846, 0)
    })

    it('calculates gap between actual and needed salary', () => {
      const grossAnnual = 85_000
      const minimumNeeded = 53_846
      const gap = grossAnnual - minimumNeeded

      expect(gap).toBeGreaterThan(0)
      expect(gap).toBeCloseTo(31_154, 0)
    })

    it('handles case where salary is below minimum needed', () => {
      const grossAnnual = 45_000
      const monthlyExpenses = 4_000
      const monthlySavings = 500
      const taxRate = estimateTaxRate(grossAnnual)

      const minimumNeeded = ((monthlyExpenses + monthlySavings) * 12) / (1 - taxRate)
      const gap = grossAnnual - minimumNeeded
      const gapPct = ((minimumNeeded - grossAnnual) / grossAnnual) * 100

      expect(gap).toBeLessThan(0)
      expect(gapPct).toBeGreaterThan(0)
    })

    it('returns zero minimum when no costs', () => {
      const totalMonthlyCosts = 0
      const taxRate = 0.22

      const minimumViableSalary =
        totalMonthlyCosts > 0 ? (totalMonthlyCosts * 12) / (1 - taxRate) : 0

      expect(minimumViableSalary).toBe(0)
    })
  })

  describe('pay ratio calculations', () => {
    it('calculates CEO-to-worker ratio', () => {
      const ceoPay = 25_000_000 // $25M total comp
      const workerPay = 85_000 // $85K

      const ratio = Math.round(ceoPay / workerPay)
      expect(ratio).toBe(294)
    })

    it('formats ratio string', () => {
      const ceoPay = 25_000_000
      const workerPay = 85_000
      const ratio = Math.round(ceoPay / workerPay)

      expect(`${ratio}:1`).toBe('294:1')
    })

    it('handles equity-heavy compensation', () => {
      const salary = 1_200_000
      const stockAwards = 20_000_000
      const bonus = 5_000_000
      const total = salary + stockAwards + bonus

      expect(total).toBe(26_200_000)

      const stockPercent = (stockAwards / total) * 100
      expect(stockPercent).toBeCloseTo(76.3, 0)
    })
  })
})
