-- Migration: per-section AI summaries + human review state on filing_sections
--
-- Pushes the human-review pipeline (introduced for filing_summaries in
-- 20260427120000_human_review_pipeline.sql) down to the section grain so
-- reviewers can verify / edit individual SEC items (Item 1 Business Overview,
-- Item 1A Risk Factors, etc.) instead of the whole filing.
--
-- After this migration:
--   • filing_sections rows carry their own ai_summary, human_summary, status,
--     and provenance — same enum, same lock-version pattern as filing-level.
--   • filing_summaries.ai_summary / human_summary become rollup-only:
--     executive_summary, employee_impact, structured XBRL statements
--     (income_statement, balance_sheet, cash_flow, shareholders_equity),
--     and any other cross-section synthesis. Per-item summaries no longer
--     live on filing_summaries.
--
-- Skip policy (enforced in pipeline, recorded here):
--   • fetch_status != 'success' OR text length < 200 → status='skipped',
--     summary_version=1, no Claude call.
--   • Empty / boilerplate items (1B Unresolved Staff Comments, 4 Mine Safety
--     for non-mining issuers, 15 Exhibits, 8-K signature) usually skip out.
--
-- Querying example — Item 1 of the 10-K covering fiscal 2026 for a company:
--   SELECT fs.ai_summary, fs.human_summary, fs.summarization_status
--   FROM filing_sections fs
--   JOIN filing_summaries f ON fs.filing_id = f.id
--   WHERE f.company_id = $1
--     AND f.filing_type = '10-K'
--     AND fs.section_code = '1'
--     AND f.period_end >= '2026-01-01' AND f.period_end < '2027-01-01';
--
-- No backfill: per the project owner, the database will be reset and
-- reseeded after this migration ships, so all rows are recreated under the
-- new pipeline. summary_version defaults to 0 (the "needs work" sentinel)
-- so the first seed pass picks every row up.

-- ─── Step 1: New columns on filing_sections ────────────────────────────────

ALTER TABLE filing_sections
  ADD COLUMN IF NOT EXISTS ai_summary jsonb,
  ADD COLUMN IF NOT EXISTS human_summary jsonb,
  ADD COLUMN IF NOT EXISTS summarization_status text NOT NULL DEFAULT 'ai_generated',
  ADD COLUMN IF NOT EXISTS summarization_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS summarization_updated_by uuid,
  ADD COLUMN IF NOT EXISTS summary_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS optimistic_lock_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prompt_id text;

-- ─── Step 2: Status enum CHECK constraint ──────────────────────────────────
-- Same value set as filing_summaries_status_check, plus 'skipped' so the
-- pipeline can record items it intentionally bypassed (empty / sub-threshold
-- raw text). 'skipped' is terminal until a human upgrades it.

ALTER TABLE filing_sections
  ADD CONSTRAINT filing_sections_status_check
  CHECK (summarization_status IN (
    'ai_generated',
    'human_verified',
    'human_edited',
    'human_authored',
    'skipped'
  ));

-- ─── Step 3: FK on actor (matches filing_summaries pattern) ────────────────

ALTER TABLE filing_sections
  ADD CONSTRAINT filing_sections_updated_by_fk
  FOREIGN KEY (summarization_updated_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- ─── Step 4: Indexes for review queue + pipeline scans ─────────────────────

-- Review-list by status, newest first (mirrors the filing-level index)
CREATE INDEX IF NOT EXISTS filing_sections_review_status_idx
  ON filing_sections (summarization_status, summarization_updated_at DESC);

-- Per-filing review by status (drives the section-edit CLI)
CREATE INDEX IF NOT EXISTS filing_sections_filing_status_idx
  ON filing_sections (filing_id, summarization_status);

-- Pipeline "needs work" partial index — cheap scan for the seed loop
CREATE INDEX IF NOT EXISTS filing_sections_pending_summarize_idx
  ON filing_sections (filing_id)
  WHERE summary_version = 0 OR summary_version = -1;
