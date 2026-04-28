-- Add unique constraints to domain tables for dedup integrity.
-- These back the application-level dedup checks with database guarantees.

-- Insider trades: unique per transaction within a filing
-- Uses COALESCE for nullable accession_number to handle legacy rows
CREATE UNIQUE INDEX IF NOT EXISTS insider_trades_dedup_idx
  ON insider_trades (company_id, filer_name, transaction_date, shares, is_derivative, COALESCE(accession_number, ''));

-- Executive compensation: unique per executive per fiscal year per company
CREATE UNIQUE INDEX IF NOT EXISTS exec_comp_dedup_idx
  ON executive_compensation (company_id, executive_name, fiscal_year);

-- Directors: unique per director per company
CREATE UNIQUE INDEX IF NOT EXISTS directors_dedup_idx
  ON directors (company_id, name);
