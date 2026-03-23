-- Add missing SEC API fields to insider_trades for derivative transaction data.
-- These fields were available in raw_sec_responses but not extracted during Phase 2 processing.
-- All columns are nullable to preserve backward compatibility with existing rows.

ALTER TABLE insider_trades
  ADD COLUMN IF NOT EXISTS transaction_description text,
  ADD COLUMN IF NOT EXISTS direct_or_indirect text,
  ADD COLUMN IF NOT EXISTS exercise_date text,
  ADD COLUMN IF NOT EXISTS expiration_date text,
  ADD COLUMN IF NOT EXISTS conversion_or_exercise_price numeric,
  ADD COLUMN IF NOT EXISTS underlying_security_title text,
  ADD COLUMN IF NOT EXISTS underlying_security_shares numeric,
  ADD COLUMN IF NOT EXISTS extra_data jsonb;
