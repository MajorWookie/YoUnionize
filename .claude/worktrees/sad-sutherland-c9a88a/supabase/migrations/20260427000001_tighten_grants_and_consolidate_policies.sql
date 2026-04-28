-- Follow-ups to 20260427000000_enable_rls.sql:
--   1. Revoke `anon` access on private/internal tables so they no longer appear
--      in the anon GraphQL schema (lint 0026).
--   2. Revoke `authenticated` access on service-only tables (lint 0027).
--   3. Consolidate personalized_summaries policies onto consistent naming and
--      role targeting (authenticated, snake_case).
--
-- Note: revoking SELECT from `authenticated` on a table that signed-in users
-- need to read would break access (a policy without a GRANT does nothing).
-- That's why we only revoke `authenticated` on the service-only tables —
-- public SEC tables and user-owned tables keep their grants.

-- ============================================================
-- 1. Revoke `anon` on private user-owned tables
-- ============================================================

REVOKE ALL ON TABLE
  "users",
  "user_profiles",
  "user_cost_of_living",
  "compensation_analyses",
  "personalized_summaries"
FROM anon;

-- ============================================================
-- 2. Revoke all access from anon AND authenticated on service-only tables
--    (Edge Functions reach them through the postgres role, which bypasses)
-- ============================================================

REVOKE ALL ON TABLE
  "embeddings",
  "jobs",
  "raw_sec_responses"
FROM anon, authenticated;

-- ============================================================
-- 3. Consolidate personalized_summaries policies
--    Drop the legacy {public}-roled policies from 20260323; the new
--    snake_case {authenticated} policies (added in 20260427000000) cover
--    SELECT/INSERT/UPDATE/DELETE consistently.
-- ============================================================

DROP POLICY IF EXISTS "Users can read own personalized summaries" ON "personalized_summaries";
DROP POLICY IF EXISTS "Users can insert own personalized summaries" ON "personalized_summaries";

DROP POLICY IF EXISTS "personalized_summaries_select_own" ON "personalized_summaries";
CREATE POLICY "personalized_summaries_select_own" ON "personalized_summaries"
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "personalized_summaries_insert_own" ON "personalized_summaries";
CREATE POLICY "personalized_summaries_insert_own" ON "personalized_summaries"
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
