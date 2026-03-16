/**
 * Auth tables are now managed by Supabase in the `auth` schema.
 * This file is intentionally empty — Supabase handles user, session,
 * and verification tables automatically.
 *
 * The application `users` table in users.ts references Supabase's
 * auth.users.id (UUID) as its primary key.
 */
