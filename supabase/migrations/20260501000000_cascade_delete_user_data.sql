-- Cascade-delete user-owned data when an auth.users row is deleted.
--
-- Background
-- ----------
-- public.users is populated by the handle_new_user() trigger
-- (20260316000000_sync_auth_users.sql) on auth.users INSERT, but no FK ties the
-- two tables together. Deleting an auth user (Supabase dashboard, the Auth Admin
-- API, supabase.auth.admin.deleteUser, etc.) therefore leaves public.users plus
-- all its children (user_profiles, user_cost_of_living, compensation_analyses)
-- as orphans.
--
-- Cascade chain after this migration:
--   auth.users  ──delete──▶ public.users               (NEW: ON DELETE CASCADE)
--                            ├─▶ user_profiles         (existing CASCADE)
--                            ├─▶ user_cost_of_living   (existing CASCADE)
--                            └─▶ compensation_analyses (existing CASCADE)
--
-- Already covered (no change):
--   - personalized_summaries.user_id → auth.users(id) ON DELETE CASCADE
--   - filing_summaries.summarization_updated_by  ON DELETE SET NULL  (audit)
--   - filing_sections.summarization_updated_by   ON DELETE SET NULL  (audit)
--
-- Policy note
-- -----------
-- Intentionally a hard wipe, not a soft delete or archive. If we later want to
-- retain anonymized records for analytics or model training, do it via a
-- separate archive table populated by a BEFORE DELETE trigger -- do NOT weaken
-- this cascade.

-- Step 1: Remove any pre-existing orphans so the FK can be validated. On a
-- healthy database this should affect zero rows; the chained CASCADEs below
-- will sweep up children automatically.
DELETE FROM public.users
WHERE id NOT IN (SELECT id FROM auth.users);

-- Step 2: Add the missing FK from public.users.id to auth.users(id).
ALTER TABLE public.users
  ADD CONSTRAINT users_id_auth_users_id_fk
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
