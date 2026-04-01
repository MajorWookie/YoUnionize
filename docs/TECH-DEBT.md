# Known Tech Debt

## High Priority

- [ ] **In-memory job queue partially replaced** — Edge Functions use PostgreSQL `jobs` table (ADR-005), but legacy `app/api/` routes still import the old in-memory `src/server/job-queue.ts`. DB-backed replacement exists at `src/server/job-queue-db.ts`. Full cleanup requires deleting `app/api/` routes.
- [ ] **Lambda migrate handler is stale** — `src/server/lambda/migrate.ts` imports from `drizzle-orm/node-postgres/migrator` and references `./src/database/migrations` (non-existent). Per ADR-008, migrations are now in `supabase/migrations/`. This handler will fail at deploy. Needs rewrite or removal.
- [ ] **No rate limiting on API endpoints** — RAG queries and compensation analysis are computationally expensive with no throttling.
- [ ] **Email confirmations disabled** in Supabase auth config — anyone can sign up with any email.

## Medium Priority

- [ ] **Legacy `app/api/` routes not deleted** — 14 One Framework `+api.ts` files remain in `app/api/`. Per ADR-007, all API logic moved to Edge Functions. These are dead code but confusing.
- [ ] **Duplicate type definitions** — `FinancialLineItem`, `FinancialStatement` defined in both `src/server/services/xbrl-transformer.ts` and `src/features/company/types.ts`. `ExecCompSummary` now also in `src/features/company/types.ts`. `CompanySummaryResult` and `EmployeeImpactResult` defined in both `packages/ai/src/types.ts` and `src/features/company/types.ts`. Should be extracted to a shared location.
- [ ] **No structured logging** — All logging via `console.info()` with no request IDs, user context, or JSON structure. Hard to search in production.
- [ ] **No E2E tests in CI** — Playwright scaffolded but no test files or CI integration.
- [ ] **No SAST/dependency scanning** in CI pipeline.
- [ ] **`company-ingest` Edge Function is legacy** — Superseded by the 2-phase `company-fetch` + `company-process` per ADR-009. Should be removed alongside legacy `app/api/` cleanup.

## Low Priority

- [ ] **SST config references One Framework** — `sst.config.ts` still sets `ONE_SERVER_URL` env var. Should be removed or renamed post-migration.
- [ ] **Tamagui v2.0.0-rc.15 is pre-release** — API may change. Monitor for stable release (works currently).
- [ ] **API client error parsing** — `fetchWithRetry()` assumes JSON error responses; HTML error pages (502) will cause secondary parse failures.
- [ ] **Summarization text chunking** — Hardcoded 4 chars/token ratio is approximate; overlap of 50 tokens may lose context at chunk boundaries.

## Resolved

- [x] **~~Dual migration systems~~** — Consolidated to Supabase migrations only. drizzle-kit removed, stale Drizzle migrations deleted (2026-03-18).
- [x] **~~CI type-check allows pre-existing errors~~** — `continue-on-error: true` removed (2026-03-21). Type-check is now blocking in CI.
- [x] **~~Insider trade field extraction incomplete~~** — Fixed (2026-03-22): added 7 new columns + `extra_data` JSONB overflow to `insider_trades`.
