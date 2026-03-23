-- Enhanced name deduplication: add canonical_name to directors, re-backfill
-- normalized_name with middle-initial stripping on both directors and
-- executive_compensation.
--
-- The PL/pgSQL helper function mirrors the TypeScript normalizeName() in
-- packages/helpers/src/normalize-name.ts — keep them in sync.

-- Step 1: Add canonical_name column to directors
ALTER TABLE directors ADD COLUMN IF NOT EXISTS canonical_name text;

-- Step 2: Create a helper function that matches the enhanced TypeScript normalizeName()
CREATE OR REPLACE FUNCTION normalize_person_name(raw_name text) RETURNS text AS $$
DECLARE
  cleaned text;
  tokens text[];
  result text[];
  tok text;
  i int;
  len int;
BEGIN
  -- Trim and strip suffixes (same regex as TypeScript SUFFIX_PATTERN)
  cleaned := trim(regexp_replace(
    trim(raw_name),
    '\s*,?\s*(Jr\.?|Sr\.?|II|III|IV|V|Esq\.?|Ph\.?D\.?|M\.?D\.?|CPA)\s*$',
    '', 'i'
  ));

  -- Collapse multiple spaces to single space
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');

  -- Split into tokens
  tokens := string_to_array(cleaned, ' ');
  len := array_length(tokens, 1);

  -- If 2 or fewer tokens, no middle initials to strip
  IF len IS NULL OR len <= 2 THEN
    RETURN lower(cleaned);
  END IF;

  -- Remove middle-position single-letter tokens (with optional period)
  result := ARRAY[tokens[1]];
  FOR i IN 2..(len - 1) LOOP
    tok := tokens[i];
    -- Keep token if it's longer than a single letter (optionally with period)
    IF length(regexp_replace(tok, '\.', '')) > 1 THEN
      result := array_append(result, tok);
    END IF;
  END LOOP;
  result := array_append(result, tokens[len]);

  RETURN lower(array_to_string(result, ' '));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Re-backfill normalized_name using the enhanced function
UPDATE directors SET normalized_name = normalize_person_name(name)
  WHERE name IS NOT NULL;

UPDATE executive_compensation SET normalized_name = normalize_person_name(executive_name)
  WHERE executive_name IS NOT NULL;

-- Step 4: Handle potential duplicates from re-normalization.
-- After re-backfilling, some rows may now share the same (company_id, normalized_name)
-- that were previously distinct. Keep the row with the most recent created_at (or largest id).

-- Directors: keep the row with the latest id per (company_id, normalized_name)
DELETE FROM directors d1
  USING directors d2
  WHERE d1.company_id = d2.company_id
    AND d1.normalized_name = d2.normalized_name
    AND d1.normalized_name IS NOT NULL
    AND d1.id < d2.id;

-- Executive compensation: keep the row with the latest id per (company_id, normalized_name, fiscal_year)
DELETE FROM executive_compensation e1
  USING executive_compensation e2
  WHERE e1.company_id = e2.company_id
    AND e1.normalized_name = e2.normalized_name
    AND e1.fiscal_year = e2.fiscal_year
    AND e1.normalized_name IS NOT NULL
    AND e1.id < e2.id;

-- Step 5: Drop and recreate dedup indexes (they depend on normalized_name values)
DROP INDEX IF EXISTS directors_dedup_idx;
DROP INDEX IF EXISTS exec_comp_dedup_idx;

CREATE UNIQUE INDEX directors_dedup_idx
  ON directors (company_id, normalized_name);

CREATE UNIQUE INDEX exec_comp_dedup_idx
  ON executive_compensation (company_id, normalized_name, fiscal_year);

-- Step 6: Clean up helper function
DROP FUNCTION IF EXISTS normalize_person_name(text);
