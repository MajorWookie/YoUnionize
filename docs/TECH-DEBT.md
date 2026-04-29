# Known Tech Debt

## High Priority

- [ ] **No rate limiting on API endpoints** — RAG queries and compensation analysis are computationally expensive with no throttling.
- [ ] **Email confirmations disabled** in Supabase auth config — anyone can sign up with any email.
- [ ] **Display layer reads filing_summaries.ai_summary for per-item content** — After the 2026-04-29 per-section rewrite, per-item summaries (Risk Factors, MD&A, etc.) live on `filing_sections.ai_summary` instead. `CompanySummaryCard` and the `company-detail` Edge Function need updates to merge per-section rows into the response payload.

## Medium Priority

- [ ] **No structured logging** — All logging via `console.info()` with no request IDs, user context, or JSON structure. Hard to search in production.
- [ ] **No E2E tests in CI** — Playwright scaffolded but no test files or CI integration.
- [ ] **No SAST/dependency scanning** in CI pipeline.
- [ ] **Section-level review CLI + Edge Functions deferred** — Per-section review state landed in the schema (2026-04-29) but the `review section-list/verify/edit` commands and matching `review-section-*` Edge Functions are pending a follow-up branch. Filing-level review still works.
- [ ] **Specialized prompts deferred** — Dispatch table reserves slots for `cybersecurity`, `controls_and_procedures`, `related_transactions` prompt kinds, but they currently route through the generic `narrative` prompt label. Specialized prompt files in `packages/ai/src/prompts/` are pending a follow-up branch.

## Low Priority

- [ ] **SST config references One Framework** — `sst.config.ts` still sets `ONE_SERVER_URL` env var. Should be removed or renamed post-migration.
- [ ] **Tamagui v2.0.0-rc.15 is pre-release** — API may change. Monitor for stable release (works currently).
- [ ] **API client error parsing** — `fetchWithRetry()` assumes JSON error responses; HTML error pages (502) will cause secondary parse failures.
- [ ] **Summarization text chunking** — Hardcoded 4 chars/token ratio is approximate; overlap of 50 tokens may lose context at chunk boundaries.
- [ ] **Lambda ingestion handler still wired in `sst.config.ts`** — `src/server/lambda/ingestion.ts` exposes `fetchHandler`/`processHandler` as Lambda entry points, paralleling the live Edge Function 2-phase pipeline. Decide whether to keep an AWS deployment path or retire the lambda + sst.config entries.

## Resolved

- [x] **~~Dual migration systems~~** — Consolidated to Supabase migrations only. drizzle-kit removed, stale Drizzle migrations deleted (2026-03-18).
- [x] **~~CI type-check allows pre-existing errors~~** — `continue-on-error: true` removed (2026-03-21). Type-check is now blocking in CI.
- [x] **~~Insider trade field extraction incomplete~~** — Fixed (2026-03-22): added 7 new columns + `extra_data` JSONB overflow to `insider_trades`.
- [x] **~~In-memory job queue~~** — Resolved (2026-04-29): legacy `app/api/` routes deleted, leaving `src/server/job-queue-db.ts` as the only path. The in-memory `job-queue.ts` had already been removed; this entry's blocker (the legacy routes that imported it) is now gone.
- [x] **~~Lambda migrate handler stale~~** — Removed (2026-04-29). `src/server/lambda/migrate.ts` deleted; migrations live in `supabase/migrations/` per ADR-008.
- [x] **~~Legacy `app/api/` routes~~** — Removed (2026-04-29). All 13 One Framework `+api.ts` files deleted; API surface is Edge Functions only per ADR-007. `src/lib/api-base.ts` updated to drop the `company-ingest` route pattern.
- [x] **~~Duplicate type definitions~~** — Resolved (2026-04-29). `src/features/company/types.ts` now re-exports `FilingSummaryResult`/`CompanySummaryResult`/`EmployeeImpactResult` from `@younionize/ai` and `FinancialLineItem`/`FinancialStatement` from `~/server/services/xbrl-transformer`. `ExecCompSummary` retains its single home in the company types barrel.
- [x] **~~`company-ingest` Edge Function~~** — Removed (2026-04-29). `supabase/functions/company-ingest/` deleted; `company-fetch` + `company-process` per ADR-009 are the only ingest path.
- [x] **~~Edge Function schema out of sync~~** — Fixed (2026-04-29) as part of the per-section rewrite. `supabase/functions/_shared/schema.ts` was missing `raw_data_override`, `human_summary`, `summarization_status`, `summarization_updated_at`, `summarization_updated_by`, `optimistic_lock_version` on `filing_summaries`. Now in sync with `src/database/schema/filings.ts`.
