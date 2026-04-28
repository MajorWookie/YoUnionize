-- Human-in-the-loop review pipeline (Phase 1 — CLI MVP, Phase 2 — UI).
--
-- Adds review-state columns to filing_summaries:
--   • raw_data_override     — user edit of the SEC raw payload; if present,
--                             overrides raw_data as the input to summarization.
--   • human_summary         — user edit of the AI summary; if present, overrides
--                             ai_summary for display. ai_summary is never
--                             written by humans — it remains the AI baseline
--                             used for the >=80% delta check that decides
--                             between 'human_edited' and 'human_authored'.
--   • summarization_status  — provenance: AI Generated / Human Verified /
--                             Human Edited / Human Authored.
--   • summarization_updated_at / _by — last status change actor + timestamp.
--                             _by references auth.users(id); the CLI logs in
--                             as a real Supabase user so its writes carry the
--                             same identity shape as the future UI.
--   • optimistic_lock_version — cheap insurance against concurrent edits in
--                               Phase 2; CLI in Phase 1 is single-user and
--                               will leave this at 0 most of the time.
--
-- summary_version is repurposed slightly:
--   • > 0  = current AI version (existing semantics)
--   •   0  = needs (re-)summarization. Replaces the previous
--            isNull(ai_summary) sentinel used by the pipeline.
--   •  -1  = last re-summarization failed; surfaced via
--            `review list --status failed` for manual intervention.

-- Step 1: New columns
ALTER TABLE filing_summaries
  ADD COLUMN IF NOT EXISTS raw_data_override jsonb,
  ADD COLUMN IF NOT EXISTS human_summary jsonb,
  ADD COLUMN IF NOT EXISTS summarization_status text,
  ADD COLUMN IF NOT EXISTS summarization_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS summarization_updated_by uuid,
  ADD COLUMN IF NOT EXISTS optimistic_lock_version integer NOT NULL DEFAULT 0;

-- Step 2: Backfill status / timestamp for existing rows
--   • Rows with an ai_summary become 'ai_generated'.
--   • Rows without one keep status NULL until the first AI run, but we still
--     set updated_at so ORDER BY works.
UPDATE filing_summaries
SET
  summarization_status = CASE
    WHEN ai_summary IS NOT NULL THEN 'ai_generated'
    ELSE 'ai_generated'  -- pre-existing rows are treated as AI-baseline state
  END,
  summarization_updated_at = COALESCE(summarization_updated_at, updated_at, now())
WHERE summarization_status IS NULL;

-- Step 3: Migrate the "needs work" sentinel.
--   The pipeline previously used `WHERE ai_summary IS NULL` to find
--   unsummarized filings. We swap that to `summary_version = 0` so the
--   re-summarization path can blank the marker without destroying the prior
--   AI summary (a human user might still want to see the stale version).
UPDATE filing_summaries
SET summary_version = 0
WHERE ai_summary IS NULL AND (summary_version IS NULL OR summary_version > 0);

-- Existing rows with an ai_summary but a NULL summary_version → assume v1
UPDATE filing_summaries
SET summary_version = 1
WHERE ai_summary IS NOT NULL AND summary_version IS NULL;

-- Step 4: Tighten constraints now that backfill is done
ALTER TABLE filing_summaries
  ALTER COLUMN summarization_status SET NOT NULL,
  ALTER COLUMN summarization_status SET DEFAULT 'ai_generated',
  ALTER COLUMN summarization_updated_at SET NOT NULL,
  ALTER COLUMN summarization_updated_at SET DEFAULT now(),
  ALTER COLUMN summary_version SET NOT NULL;

-- Step 5: CHECK constraint on the status enum
--   Using text + CHECK rather than a Postgres enum because enum migrations
--   (rename/remove values) are painful and Phase 2 may evolve this set.
ALTER TABLE filing_summaries
  ADD CONSTRAINT filing_summaries_status_check
  CHECK (summarization_status IN (
    'ai_generated',
    'human_verified',
    'human_edited',
    'human_authored'
  ));

-- Step 6: Foreign key on actor (deferred-style — SET NULL on user delete so
-- audit rows survive even if the reviewing user is removed).
ALTER TABLE filing_summaries
  ADD CONSTRAINT filing_summaries_updated_by_fk
  FOREIGN KEY (summarization_updated_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- Step 7: Indexes for the most common review-list queries
--   • Filter by status (most common: ai_generated awaiting review)
--   • Sort by recency within a company
CREATE INDEX IF NOT EXISTS filing_summaries_review_status_idx
  ON filing_summaries (summarization_status, summarization_updated_at DESC);

CREATE INDEX IF NOT EXISTS filing_summaries_review_company_idx
  ON filing_summaries (company_id, summarization_status, summarization_updated_at DESC);

-- Step 8: Index for the pipeline's "needs work" scan
CREATE INDEX IF NOT EXISTS filing_summaries_pending_resummarize_idx
  ON filing_summaries (company_id)
  WHERE summary_version = 0 OR summary_version = -1;
