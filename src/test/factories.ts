/**
 * Test data factories for creating typed mock objects.
 */

import type { Filing, FilingQueryResponse, CompanyMapping, ExecutiveCompensationResponse, InsiderTradingResponse, DirectorsResponse } from '@union/sec-api'
import type { FilingSummaryResult, CompensationAnalysisResult, AiResponse, TokenUsage } from '@union/ai'

// ── Counters for unique IDs ─────────────────────────────────────────────

let idCounter = 0
function nextId() {
  return `test-${++idCounter}`
}

// ── SEC API response factories ──────────────────────────────────────────

export function createFiling(overrides: Partial<Filing> = {}): Filing {
  const id = nextId()
  return {
    id,
    accessionNo: `0001234567-24-${String(idCounter).padStart(6, '0')}`,
    cik: '0001234567',
    ticker: 'TEST',
    companyName: 'Test Corp',
    companyNameLong: 'Test Corporation Inc.',
    formType: '10-K',
    description: 'Annual Report',
    filedAt: '2024-03-15T00:00:00.000Z',
    linkToTxt: `https://efts.sec-api.io/filing/${id}.txt`,
    linkToHtml: `https://efts.sec-api.io/filing/${id}.html`,
    linkToXbrl: `https://efts.sec-api.io/filing/${id}.xbrl`,
    linkToFilingDetails: `https://efts.sec-api.io/filing/${id}`,
    entities: [
      {
        companyName: 'Test Corp',
        cik: '0001234567',
        ticker: 'TEST',
        irsNo: '12-3456789',
        stateOfIncorporation: 'DE',
        fiscalYearEnd: '1231',
        type: '10-K',
      },
    ],
    documentFormatFiles: [],
    dataFiles: [],
    periodOfReport: '2024-12-31',
    ...overrides,
  }
}

export function createFilingQueryResponse(
  filings: Array<Filing> = [createFiling()],
): FilingQueryResponse {
  return {
    total: { value: filings.length, relation: 'eq' },
    filings,
  }
}

export function createCompanyMapping(overrides: Partial<CompanyMapping> = {}): CompanyMapping {
  return {
    name: 'Test Corp',
    ticker: 'TEST',
    cik: '0001234567',
    cusip: '12345678',
    exchange: 'NYSE',
    isDelisted: false,
    category: 'Domestic',
    sector: 'Technology',
    industry: 'Software',
    sic: '7372',
    currency: 'USD',
    location: 'San Francisco, CA',
    id: nextId(),
    ...overrides,
  }
}

export function createExecCompResponse(
  count = 3,
): ExecutiveCompensationResponse {
  return {
    total: { value: count, relation: 'eq' },
    data: Array.from({ length: count }, (_, i) => ({
      ticker: 'TEST',
      cik: '0001234567',
      companyName: 'Test Corp',
      executiveName: i === 0 ? 'Jane CEO' : `Executive ${i + 1}`,
      position: i === 0 ? 'CEO' : `VP ${i + 1}`,
      reportingYear: 2024,
      salary: (50_000_000 - i * 10_000_000),
      bonus: 5_000_000,
      stockAwards: 20_000_000,
      optionAwards: 10_000_000,
      nonEquityIncentive: 3_000_000,
      pension: 500_000,
      otherCompensation: 200_000,
      totalCompensation: 88_700_000 - i * 10_000_000,
      ceoPayRatio: i === 0 ? '272:1' : undefined,
      filedAt: '2024-04-15T00:00:00.000Z',
    })),
  }
}

export function createInsiderTradingResponse(): InsiderTradingResponse {
  return {
    total: { value: 2, relation: 'eq' },
    data: [
      {
        id: nextId(),
        accessionNo: '0001234567-24-000001',
        filedAt: '2024-06-01T00:00:00.000Z',
        issuer: { cik: '0001234567', name: 'Test Corp', ticker: 'TEST' },
        reportingOwner: {
          cik: '0009876543',
          name: 'Jane CEO',
          relationship: {
            isDirector: true,
            isOfficer: true,
            officerTitle: 'CEO',
            isTenPercentOwner: false,
            isOther: false,
          },
        },
        transactions: [
          {
            transactionDate: '2024-05-30',
            transactionCode: 'S',
            sharesTraded: 10000,
            pricePerShare: 150.5,
            sharesOwnedAfter: 500000,
            transactionType: 'Non-Derivative',
          },
        ],
      },
      {
        id: nextId(),
        accessionNo: '0001234567-24-000002',
        filedAt: '2024-05-15T00:00:00.000Z',
        issuer: { cik: '0001234567', name: 'Test Corp', ticker: 'TEST' },
        reportingOwner: {
          cik: '0009876544',
          name: 'John CFO',
          relationship: {
            isDirector: false,
            isOfficer: true,
            officerTitle: 'CFO',
            isTenPercentOwner: false,
            isOther: false,
          },
        },
        transactions: [
          {
            transactionDate: '2024-05-14',
            transactionCode: 'P',
            sharesTraded: 5000,
            pricePerShare: 145.0,
            sharesOwnedAfter: 100000,
            transactionType: 'Non-Derivative',
          },
        ],
      },
    ],
  }
}

export function createDirectorsResponse(): DirectorsResponse {
  return {
    total: { value: 2, relation: 'eq' },
    data: [
      {
        ticker: 'TEST',
        cik: '0001234567',
        companyName: 'Test Corp',
        name: 'Alice Board',
        title: 'Lead Independent Director',
        isIndependent: true,
        committees: ['Audit', 'Compensation'],
        qualifications: 'Former CEO of BigCo',
        filedAt: '2024-04-15T00:00:00.000Z',
      },
      {
        ticker: 'TEST',
        cik: '0001234567',
        companyName: 'Test Corp',
        name: 'Bob Director',
        title: 'Director',
        isIndependent: true,
        committees: ['Nominating'],
        qualifications: 'Industry Expert',
        filedAt: '2024-04-15T00:00:00.000Z',
      },
    ],
  }
}

// ── AI response factories ───────────────────────────────────────────────

export function createTokenUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    inputTokens: 1500,
    outputTokens: 800,
    ...overrides,
  }
}

export function createFilingSummaryResult(
  overrides: Partial<FilingSummaryResult> = {},
): FilingSummaryResult {
  return {
    executive_summary: 'Test Corp had a solid year with revenue growth of 15%.',
    key_numbers: [
      { label: 'Revenue', value: '$10.5B', context: 'Up 15% year-over-year' },
      { label: 'Net Income', value: '$2.1B', context: 'Margin improved to 20%' },
    ],
    plain_language_explanation:
      'The company made more money this year than last year, mostly from selling more products.',
    red_flags: ['Increasing debt-to-equity ratio'],
    opportunities: ['Expanding into new markets'],
    employee_relevance:
      'Workforce grew 8%. No mentions of layoffs or restructuring.',
    ...overrides,
  }
}

export function createCompensationAnalysisResult(
  overrides: Partial<CompensationAnalysisResult> = {},
): CompensationAnalysisResult {
  return {
    fairness_score: 55,
    explanation:
      'Your pay is below the median for your role in this industry. The CEO-to-worker pay ratio at Test Corp is 272:1, which is in line with the S&P 500 average.',
    comparisons: [
      {
        label: 'CEO Pay Ratio',
        insight: 'At 272:1, this is right at the S&P 500 median.',
      },
      {
        label: 'Your Pay vs Revenue/Employee',
        insight:
          'Test Corp generates $525K per employee. Your pay represents 16% of your revenue contribution.',
      },
    ],
    recommendations: [
      'Research salary bands for your role at competing companies.',
      'Consider asking about equity compensation to close the total comp gap.',
    ],
    ...overrides,
  }
}

export function createAiResponse<T>(
  data: T,
  overrides: Partial<AiResponse<T>> = {},
): AiResponse<T> {
  return {
    data,
    usage: createTokenUsage(),
    cached: false,
    ...overrides,
  }
}

// ── Database record factories ───────────────────────────────────────────

export function createTestUser(overrides: Record<string, unknown> = {}) {
  const id = nextId()
  return {
    id,
    email: `user-${id}@test.com`,
    name: 'Test User',
    ...overrides,
  }
}

export function createTestCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId(),
    ticker: 'TEST',
    name: 'Test Corp',
    cik: '0001234567',
    sector: 'Technology',
    industry: 'Software',
    exchange: 'NYSE',
    ...overrides,
  }
}

export function createTestFiling(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId(),
    companyId: 'company-1',
    filingType: '10-K',
    periodEnd: '2024-12-31',
    filedAt: '2024-03-15T00:00:00.000Z',
    accessionNumber: `0001234567-24-${String(idCounter).padStart(6, '0')}`,
    rawData: {},
    aiSummary: null,
    summaryVersion: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createTestProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId(),
    userId: 'user-1',
    jobTitle: 'Software Engineer',
    orgLevelCode: 'IC3',
    grossAnnualPay: 8_500_000, // $85,000 in cents
    companyTicker: 'TEST',
    ...overrides,
  }
}

export function createTestCostOfLiving(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId(),
    userId: 'user-1',
    rentMortgage: 200_000,  // $2,000/mo
    internet: 8_000,
    mobilePhone: 8_000,
    utilities: 15_000,
    studentLoans: 30_000,
    consumerDebt: null,
    carLoan: 40_000,
    groceries: 60_000,
    gym: 5_000,
    entertainment: 15_000,
    clothing: 10_000,
    savingsTarget: 50_000,
    other: null,
    ...overrides,
  }
}

// ── XBRL data factory ───────────────────────────────────────────────────

export function createXbrlData() {
  return {
    StatementsOfIncome: {
      Revenues: {
        '2024-12-31': 10_500_000_000,
        '2023-12-31': 9_130_000_000,
      },
      CostOfRevenue: {
        '2024-12-31': 6_300_000_000,
        '2023-12-31': 5_650_000_000,
      },
      GrossProfit: {
        '2024-12-31': 4_200_000_000,
        '2023-12-31': 3_480_000_000,
      },
      OperatingIncomeLoss: {
        '2024-12-31': 2_800_000_000,
        '2023-12-31': 2_200_000_000,
      },
      NetIncomeLoss: {
        '2024-12-31': 2_100_000_000,
        '2023-12-31': 1_650_000_000,
      },
    },
    BalanceSheets: {
      Assets: {
        '2024-12-31': 50_000_000_000,
        '2023-12-31': 45_000_000_000,
      },
      Liabilities: {
        '2024-12-31': 30_000_000_000,
        '2023-12-31': 28_000_000_000,
      },
      StockholdersEquity: {
        '2024-12-31': 20_000_000_000,
        '2023-12-31': 17_000_000_000,
      },
      CashAndCashEquivalentsAtCarryingValue: {
        '2024-12-31': 8_000_000_000,
        '2023-12-31': 6_500_000_000,
      },
    },
    StatementsOfCashFlows: {
      NetCashProvidedByUsedInOperatingActivities: {
        '2024-12-31': 3_500_000_000,
        '2023-12-31': 2_800_000_000,
      },
      NetCashProvidedByUsedInInvestingActivities: {
        '2024-12-31': -1_200_000_000,
        '2023-12-31': -900_000_000,
      },
      NetCashProvidedByUsedInFinancingActivities: {
        '2024-12-31': -800_000_000,
        '2023-12-31': -700_000_000,
      },
    },
  }
}
