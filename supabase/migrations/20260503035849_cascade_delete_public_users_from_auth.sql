-- Cascade delete public.users (and its dependents) when an auth.users row is deleted.
--
-- Background:
--   - 20260316000000_sync_auth_users.sql added a trigger that creates a public.users
--     row on every auth.users insert, but never wired up a foreign key to mirror the
--     reverse direction. So when a user is removed from auth.users, the public.users
--     row (and everything cascading off it: user_profiles, user_cost_of_living,
--     compensation_analyses) was left orphaned.
--   - 20260427000000_enable_rls.sql:33-34 already documented the intended behavior
--     ("deleted via cascade from auth.users"); this migration delivers it.
--
-- Note: personalized_summaries.user_id already references auth.users(id) ON DELETE
-- CASCADE directly (see 20260323000000_personalized_summaries.sql), so it's covered
-- without needing changes here.

-- Step 1: Remove any pre-existing orphans in public.users so the new FK can be
-- added without violating constraints. Cascades through user_profiles,
-- user_cost_of_living, and compensation_analyses.
DELETE FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users a WHERE a.id = u.id
);

-- Step 2: Add the cascading foreign key.
ALTER TABLE public.users
  ADD CONSTRAINT users_id_auth_users_id_fk
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
