# ADR-005: PostgreSQL-backed job queue + Lambda workers

- **Date**: 2026-03-17
- **Decision**: Replace in-memory job queue with PostgreSQL `jobs` table + Lambda workers
- **Rationale**: Edge Functions are stateless (no in-memory state). Jobs are now persisted in PostgreSQL with atomic claiming. Long-running operations (ingestion, summarization) are processed by Lambda workers with 900s timeout.
- **Previous**: In-memory Map (ADR-005 original, 2026-03-13) -- replaced due to job loss on restart.
- **Migration status**: **Partial** -- Edge Functions use DB-backed queue (`src/server/job-queue-db.ts`), but legacy `app/api/` routes still import the old in-memory queue (`src/server/job-queue.ts`). Full migration blocked on deleting legacy API routes.
- **Status**: Active (partially implemented)
