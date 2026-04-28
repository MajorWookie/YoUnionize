-- Migration: filing_sections — normalize SEC filing section text into a dedicated table
--
-- Replaces the JSON blob at filing_summaries.raw_data.extractedSections.
-- One row per (filing, section_code). Stores raw SEC section codes
-- ('7', '1A', 'part1item2', '5-2'). Captures fetch errors explicitly so
-- failed extractions are no longer silently dropped by Promise.allSettled.
--
-- Rollout: this migration creates the table and backfills from existing
-- raw_data. The follow-up cleanup of raw_data.extractedSections is deferred
-- to a later migration so we keep a rollback escape hatch.

CREATE TABLE "filing_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "filing_id" uuid NOT NULL REFERENCES "filing_summaries"("id") ON DELETE CASCADE,
  "section_code" text NOT NULL,
  "text" text,
  "fetch_status" text NOT NULL DEFAULT 'success',
  "fetch_error" text,
  "extracted_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "filing_sections_filing_code_idx"
  ON "filing_sections" ("filing_id", "section_code");

CREATE INDEX "filing_sections_filing_id_idx"
  ON "filing_sections" ("filing_id");

CREATE INDEX "filing_sections_code_idx"
  ON "filing_sections" ("section_code");

-- ─── RLS: internal-only ────────────────────────────────────────────────────
-- Section text is only consumed server-side (summarization, RAG generation).
-- Same posture as raw_sec_responses: RLS on with no client policy → default
-- deny for authenticated clients; postgres-js connections (Edge Functions,
-- server services) bypass RLS and retain full access.

ALTER TABLE "filing_sections" ENABLE ROW LEVEL SECURITY;

-- ─── Backfill from filing_summaries.raw_data.extractedSections ─────────────
-- Translates legacy camelCase keys to raw SEC section codes, scoped by
-- filing_type (e.g. 'mdAndA' is '7' on 10-K but 'part1item2' on 10-Q).

INSERT INTO "filing_sections" ("filing_id", "section_code", "text", "fetch_status")
SELECT
  filing_id,
  legacy_code,
  section_text,
  CASE
    WHEN section_text IS NULL OR length(section_text) = 0 THEN 'empty'
    ELSE 'success'
  END
FROM (
  SELECT
    fs.id AS filing_id,
    kv.value #>> '{}' AS section_text,
    CASE
      WHEN fs.filing_type = '10-K' AND kv.key = 'businessOverview'      THEN '1'
      WHEN fs.filing_type = '10-K' AND kv.key = 'riskFactors'           THEN '1A'
      WHEN fs.filing_type = '10-K' AND kv.key = 'mdAndA'                THEN '7'
      WHEN fs.filing_type = '10-K' AND kv.key = 'legalProceedings'      THEN '3'
      WHEN fs.filing_type = '10-K' AND kv.key = 'executiveCompensation' THEN '11'
      WHEN fs.filing_type = '10-K' AND kv.key = 'financialStatements'   THEN '8'
      WHEN fs.filing_type = '10-Q' AND kv.key = 'mdAndA'                THEN 'part1item2'
      WHEN fs.filing_type = '10-Q' AND kv.key = 'riskFactors'           THEN 'part2item1a'
      WHEN fs.filing_type = '10-Q' AND kv.key = 'legalProceedings'      THEN 'part2item1'
      WHEN fs.filing_type = '10-Q' AND kv.key = 'financialStatements'   THEN 'part1item1'
      WHEN fs.filing_type = 'DEF 14A' AND kv.key = 'proxy'                  THEN 'part1item1'
      WHEN fs.filing_type = 'DEF 14A' AND kv.key = 'executiveCompensation' THEN 'part1item7'
      ELSE NULL
    END AS legacy_code
  FROM "filing_summaries" fs,
       jsonb_each(fs.raw_data->'extractedSections') kv
  WHERE fs.raw_data ? 'extractedSections'
    AND jsonb_typeof(fs.raw_data->'extractedSections') = 'object'
) translated
WHERE legacy_code IS NOT NULL
ON CONFLICT ("filing_id", "section_code") DO NOTHING;
