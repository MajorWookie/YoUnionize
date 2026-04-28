-- Enable Row Level Security on all public tables and add appropriate policies.
--
-- Access model:
--   - User-private tables: owner-only via auth.uid() = user_id (or = id for `users`).
--   - Public SEC-derived tables: read-only for any authenticated user; writes only
--     via Edge Functions (which connect using the postgres role and bypass RLS).
--   - Internal tables (jobs, raw_sec_responses, embeddings): RLS on with no policy
--     — denies all client access; only service role / Edge Functions can read/write.
--
-- Why no policies for service-only tables: Postgres RLS denies by default when
-- enabled and no policy matches. The postgres-js client used by Edge Functions
-- connects as a superuser-equivalent role and bypasses RLS, so internal access
-- continues to work while PostgREST clients see nothing.

-- ============================================================
-- User-private tables (owner-only)
-- ============================================================

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON "users";
CREATE POLICY "users_select_own" ON "users"
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON "users";
CREATE POLICY "users_update_own" ON "users"
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT/DELETE intentionally omitted: rows are created by the
-- handle_new_user() trigger (SECURITY DEFINER) on auth.users insert,
-- and deleted via cascade from auth.users.

ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select_own" ON "user_profiles";
CREATE POLICY "user_profiles_select_own" ON "user_profiles"
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_profiles_insert_own" ON "user_profiles";
CREATE POLICY "user_profiles_insert_own" ON "user_profiles"
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_profiles_update_own" ON "user_profiles";
CREATE POLICY "user_profiles_update_own" ON "user_profiles"
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_profiles_delete_own" ON "user_profiles";
CREATE POLICY "user_profiles_delete_own" ON "user_profiles"
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE "user_cost_of_living" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_cost_of_living_select_own" ON "user_cost_of_living";
CREATE POLICY "user_cost_of_living_select_own" ON "user_cost_of_living"
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_cost_of_living_insert_own" ON "user_cost_of_living";
CREATE POLICY "user_cost_of_living_insert_own" ON "user_cost_of_living"
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_cost_of_living_update_own" ON "user_cost_of_living";
CREATE POLICY "user_cost_of_living_update_own" ON "user_cost_of_living"
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_cost_of_living_delete_own" ON "user_cost_of_living";
CREATE POLICY "user_cost_of_living_delete_own" ON "user_cost_of_living"
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE "compensation_analyses" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compensation_analyses_select_own" ON "compensation_analyses";
CREATE POLICY "compensation_analyses_select_own" ON "compensation_analyses"
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "compensation_analyses_insert_own" ON "compensation_analyses";
CREATE POLICY "compensation_analyses_insert_own" ON "compensation_analyses"
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "compensation_analyses_delete_own" ON "compensation_analyses";
CREATE POLICY "compensation_analyses_delete_own" ON "compensation_analyses"
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- personalized_summaries already has SELECT + INSERT from
-- 20260323000000_personalized_summaries.sql. Add UPDATE so the upsert
-- (INSERT ... ON CONFLICT DO UPDATE) pattern works, and DELETE for cleanup.

DROP POLICY IF EXISTS "personalized_summaries_update_own" ON "personalized_summaries";
CREATE POLICY "personalized_summaries_update_own" ON "personalized_summaries"
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "personalized_summaries_delete_own" ON "personalized_summaries";
CREATE POLICY "personalized_summaries_delete_own" ON "personalized_summaries"
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Public SEC-derived tables (read-only for authenticated users)
-- ============================================================

-- companies already has RLS enabled (no policies). Add read policy.
DROP POLICY IF EXISTS "companies_select_authenticated" ON "companies";
CREATE POLICY "companies_select_authenticated" ON "companies"
  FOR SELECT TO authenticated
  USING (true);

-- filing_summaries already has RLS enabled (no policies). Add read policy.
DROP POLICY IF EXISTS "filing_summaries_select_authenticated" ON "filing_summaries";
CREATE POLICY "filing_summaries_select_authenticated" ON "filing_summaries"
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE "directors" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "directors_select_authenticated" ON "directors";
CREATE POLICY "directors_select_authenticated" ON "directors"
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE "executive_compensation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "executive_compensation_select_authenticated" ON "executive_compensation";
CREATE POLICY "executive_compensation_select_authenticated" ON "executive_compensation"
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE "insider_trades" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insider_trades_select_authenticated" ON "insider_trades";
CREATE POLICY "insider_trades_select_authenticated" ON "insider_trades"
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE "form_8k_events" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "form_8k_events_select_authenticated" ON "form_8k_events";
CREATE POLICY "form_8k_events_select_authenticated" ON "form_8k_events"
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- Internal / service-only tables (RLS on, no policies = deny all)
-- ============================================================

-- Edge Functions reach these via the postgres-js connection (postgres role)
-- which bypasses RLS. PostgREST clients (anon, authenticated) get nothing.

ALTER TABLE "raw_sec_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "embeddings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Lock down handle_new_user RPC exposure
-- ============================================================

-- The function is meant to fire only as an auth.users trigger, not be called
-- via /rest/v1/rpc/handle_new_user. The default EXECUTE grant is on PUBLIC
-- (every role, anon/authenticated inherit through it), so a REVOKE from
-- anon/authenticated alone is a no-op — must REVOKE from PUBLIC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
