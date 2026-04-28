-- Add post-processing enrichment columns.
-- Both are nullable — populated by enrichment functions after Phase 2 ingestion.

ALTER TABLE executive_compensation ADD COLUMN canonical_name TEXT;
ALTER TABLE directors ADD COLUMN role TEXT CHECK (role IN ('director', 'officer', 'both'));
