# ADR-008: Supabase Migrations as Single Source of Truth

- **Date**: 2026-03-18
- **Decision**: Use Supabase migrations (`supabase/migrations/`) as the sole migration system. Remove drizzle-kit.
- **Rationale**: Two competing migration systems (Supabase + Drizzle) caused tables to never be created in the local DB, breaking auth signup. Drizzle ORM remains as the query builder for type-safe database access; only the migration generator (drizzle-kit) is removed. Future schema changes are written as plain SQL in `supabase/migrations/` with timestamp-prefixed filenames. Apply locally with `supabase db reset`.
- **Alternatives considered**: Keeping drizzle-kit as a SQL generation helper (rejected -- adds complexity with no clear benefit for the team size)
- **Status**: Active
