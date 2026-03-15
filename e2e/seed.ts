/**
 * E2E seed script — populates test data for Playwright tests.
 *
 * Usage: bun e2e/seed.ts
 *
 * Prerequisites: docker-compose up -d (PostgreSQL must be running)
 *
 * Creates:
 *   - A test company (AAPL / Apple Inc) with known data
 *   - A test user (test@union.app / testpassword)
 *   - Sample filings, executive compensation, and insider trades
 */

import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://union:union@localhost:5433/union'

async function seed() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 })

  try {
    console.info('[Seed] Connected to database')

    // Insert test company
    await pool.query(`
      INSERT INTO companies (id, ticker, name, cik, sector, industry, exchange)
      VALUES (
        'e2e-company-1',
        'AAPL',
        'Apple Inc.',
        '0000320193',
        'Technology',
        'Consumer Electronics',
        'NASDAQ'
      )
      ON CONFLICT (ticker) DO NOTHING
    `)
    console.info('[Seed] Company: AAPL')

    // Insert test filing summary
    await pool.query(`
      INSERT INTO filing_summaries (id, company_id, filing_type, period_end, filed_at, accession_number, raw_data, ai_summary, summary_version)
      VALUES (
        'e2e-filing-1',
        'e2e-company-1',
        '10-K',
        '2024-09-28',
        '2024-11-01T00:00:00Z',
        '0000320193-24-000001',
        '{}',
        '{"executive_summary": "Apple reported strong results with $394B in revenue.", "key_numbers": [{"label": "Revenue", "value": "$394B", "context": "Up 2% YoY"}], "plain_language_explanation": "Apple made slightly more money this year.", "red_flags": [], "opportunities": ["AI integration"], "employee_relevance": "Headcount stable at ~164K employees."}',
        1
      )
      ON CONFLICT (accession_number) DO NOTHING
    `)
    console.info('[Seed] Filing: AAPL 10-K')

    // Insert executive compensation
    await pool.query(`
      INSERT INTO executive_compensation (id, company_id, executive_name, title, fiscal_year, total_compensation, salary, bonus, stock_awards, option_awards, ceo_pay_ratio)
      VALUES
        ('e2e-exec-1', 'e2e-company-1', 'Tim Cook', 'CEO', 2024, 7417000000, 300000000, 0, 5000000000, 0, '672:1'),
        ('e2e-exec-2', 'e2e-company-1', 'Luca Maestri', 'CFO', 2024, 2739000000, 100000000, 0, 2000000000, 0, NULL)
      ON CONFLICT DO NOTHING
    `)
    console.info('[Seed] Executive compensation: 2 records')

    // Insert insider trade
    await pool.query(`
      INSERT INTO insider_trades (id, company_id, filer_name, filer_title, transaction_date, transaction_type, shares, price_per_share, total_value)
      VALUES (
        'e2e-trade-1',
        'e2e-company-1',
        'Tim Cook',
        'CEO',
        '2024-10-01',
        'sale',
        50000,
        22750,
        113750000
      )
      ON CONFLICT DO NOTHING
    `)
    console.info('[Seed] Insider trade: 1 record')

    console.info('[Seed] Done!')
  } finally {
    await pool.end()
  }
}

seed().catch((err) => {
  console.error('[Seed] Failed:', err)
  process.exit(1)
})
