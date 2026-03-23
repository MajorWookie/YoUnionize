-- Personalized filing summaries cache
-- Stores per-user "What Does This Mean for You?" overlays
CREATE TABLE IF NOT EXISTS personalized_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filing_id uuid NOT NULL REFERENCES filing_summaries(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT personalized_summaries_user_filing_key UNIQUE (user_id, filing_id)
);

-- Index for fast lookup by user + filing
CREATE INDEX IF NOT EXISTS personalized_summaries_user_filing_idx
  ON personalized_summaries (user_id, filing_id);

-- RLS: users can only read/write their own personalized summaries
ALTER TABLE personalized_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own personalized summaries"
  ON personalized_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personalized summaries"
  ON personalized_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
