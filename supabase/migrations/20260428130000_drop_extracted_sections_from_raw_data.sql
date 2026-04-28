-- Migration: drop raw_data.extractedSections from filing_summaries
--
-- Follow-up to 20260428120000_filing_sections.sql, which created the
-- normalized filing_sections table and backfilled it from this JSON key.
-- The previous migration intentionally left raw_data.extractedSections in
-- place as a rollback escape hatch. Now that filing_sections is the
-- authoritative source — and all production code paths read/write from it —
-- the duplicated JSON blob is removed to:
--
--   1. Eliminate confusion about which copy is canonical
--   2. Reclaim storage (extractedSections can be megabytes per filing)
--   3. Force any code that still reads the JSON to fail loudly during
--      review rather than silently consuming stale data

UPDATE "filing_summaries"
SET "raw_data" = "raw_data" - 'extractedSections'
WHERE "raw_data" ? 'extractedSections';
