-- Add normalized_name column for deduplication of directors and executives.
-- Normalization: lowercase, trimmed, honorific suffixes stripped (Jr., Sr., II, III, etc.)

-- Directors: add column
ALTER TABLE directors ADD COLUMN IF NOT EXISTS normalized_name text;

-- Executive compensation: add column
ALTER TABLE executive_compensation ADD COLUMN IF NOT EXISTS normalized_name text;

-- Backfill: normalize existing names
-- Strip suffixes like Jr., Sr., II, III, IV, Jr, Sr, Esq., Ph.D., MD
UPDATE directors
SET normalized_name = lower(trim(
  regexp_replace(
    trim(name),
    '\s*,?\s*(Jr\.?|Sr\.?|II|III|IV|V|Esq\.?|Ph\.?D\.?|M\.?D\.?|CPA)\s*$',
    '',
    'i'
  )
))
WHERE normalized_name IS NULL;

UPDATE executive_compensation
SET normalized_name = lower(trim(
  regexp_replace(
    trim(executive_name),
    '\s*,?\s*(Jr\.?|Sr\.?|II|III|IV|V|Esq\.?|Ph\.?D\.?|M\.?D\.?|CPA)\s*$',
    '',
    'i'
  )
))
WHERE normalized_name IS NULL;

-- Drop old dedup indexes
DROP INDEX IF EXISTS directors_dedup_idx;
DROP INDEX IF EXISTS exec_comp_dedup_idx;

-- Create new dedup indexes on normalized_name
CREATE UNIQUE INDEX directors_dedup_idx
  ON directors (company_id, normalized_name);

CREATE UNIQUE INDEX exec_comp_dedup_idx
  ON executive_compensation (company_id, normalized_name, fiscal_year);
