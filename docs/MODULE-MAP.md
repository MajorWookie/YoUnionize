# Module Map

| Directory | Responsibility |
|-----------|---------------|
| `src/` | Web app source (React + Vite + Mantine). Entry point is `src/main.tsx` → `src/App.tsx`. |
| `src/App.tsx` | Top-level `MantineProvider` + `BrowserRouter` + `Suspense` with declaratively-defined routes. Lazy-loads heavy routes (company, my-company, my-pay, executive, profile, onboarding); auth + landing routes are eager. |
| `src/main.tsx` | React root mount; imports Mantine stylesheets and the env-shim that bridges Vite env vars into `process.env` for shared workspace packages. |
| `src/theme.ts` | Mantine theme — custom palettes (`navy` brand, `slate`, `green`, `red`) layered on top of Mantine defaults. |
| `src/routes/` | Page-level routes: `home`, `sign-in`, `sign-up`, `discover`, `company`, `executive`, `onboarding`, `profile`, `my-pay`, `my-company`. |
| `src/components/` | UI building blocks: `Layout` (AppShell with auth-aware Navbar), `AuthGuard`, `AuthLayout`, `AskBar`, `CompanyTypeahead`, `MarkdownContent`, `TextSummaryCard`, `LeadershipSection`, `CeoSpotlightCard`, `IncomeStatementSunburst`, `InsiderTradingTable`, `RecentEventsList`, `FinancialsSection`, `CompensationExplanation`, `SunburstChart`. |
| `src/components/charts/` | Custom chart primitives that aren't in `@mantine/charts`: `FairnessGauge` (RingProgress wrapper), `WaterfallChart` (horizontal-bar income flow), `ComparisonBar` (two-segment split bar). |
| `src/lib/` | Client utilities — `format` (currency/date/share formatters), `summary-helpers`, `income-data-extractor`, `exec-types`, `financial-types`, `onboarding-constants`, `env-shim`, `supabase` (client). |
| `server/` | Server-side ingestion + summarization code (Bun runtime, not bundled into the web app). |
| `server/api-utils.ts` | Request/response helpers: `withLogging`, `classifyError`, `unauthorized`, etc. |
| `server/ai-client.ts` | Anthropic + embedding-client constructors used by the seed script and Lambda entry. |
| `server/sec-api-client.ts` | sec-api.io wrapper (configures the workspace `@younionize/sec-api` client with API key + retries). |
| `server/job-queue-db.ts` | PostgreSQL-backed job queue (enqueue, claim, complete, fail, listPending). |
| `server/lambda/ingestion.ts` | Lambda entry points (`fetchHandler`, `processHandler`) for AWS-side background ingestion. Used only if SST/Lambda is enabled. |
| `server/services/` | Business logic: ingestion pipelines (filing, compensation, directors, insider trading), XBRL transform, summarization, `sec-fetcher` (Phase 1 raw fetch), `raw-data-processor` (Phase 2 domain processing). |
| `server/services/enrichment/` | Post-fetch enrichment: `compensation-name-enrichment` (canonical exec names), `director-role-enrichment` (role normalization), `director-name-enrichment` (canonical director names via nickname mapping). |
| `supabase/functions/` | ~22 Supabase Edge Functions (Deno) — health, user-me, user-profile, user-cost-of-living, companies-lookup, companies-search, companies-search-sec, company-detail, company-fetch, company-process, company-summarize, company-summary-status, company-personalize, compensation-fairness, ask, batch-fetch, job-status, etc. |
| `supabase/functions/_shared/` | Shared Edge Function utilities: `db`, `auth`, `cors`, `schema` (kept in sync with `packages/postgres/src/schema/`), `api-utils`, `sec-fetch`, `sec-ingest`. |
| `supabase/migrations/` | SQL migrations (applied via `supabase db reset`). |
| `packages/ai/` | `@younionize/ai` — Anthropic SDK wrapper, Voyage AI embeddings, `extractJson` utility, prompt templates. |
| `packages/ai/src/prompts/` | Specialized prompt templates — `company-summary`, `employee-impact`, `mda-summary`, `what-this-means`, `compensation-analysis`, `rag-answer`, `workforce-signals`, etc. |
| `packages/api-client/` | `@younionize/api-client` — `fetchWithRetry` + `extractErrorMessage` (frontend HTTP client). |
| `packages/postgres/` | `@younionize/postgres` — Drizzle DB client (`getDb`, `createDb`), schema (one file per domain in `src/schema/`), relations (`src/relations.ts`), validators (`src/validators/`, Valibot), and pgvector search (`src/vector-search.ts`). |
| `packages/sec-api/` | `@younionize/sec-api` — SEC API client with Valibot-validated responses + section-prompt dispatch table. |
| `packages/helpers/` | `@younionize/helpers` — `ensureEnv()`, `normalizeName()`, `getCanonicalFirstName()` + `nickname-map.ts`, concurrency utilities, shared TypeScript types. |
| `packages/hooks/` | `@younionize/hooks` — `useAuth()` (Supabase) and `useDebounce()`. |
| `scripts/` | Utility scripts: `seed-companies.ts` (run via `bun run seed` / `bun run seed:no-ai`), `summarize-all.ts` (re-run AI summarization for already-ingested filings), `validate-rollup-rewrite.ts` (PR 5b validation harness). |
| `tests/` | Test factories shared across `server/` test files (`factories.ts`). |
| `vitest.setup.ts` | Vitest setup (env defaults). |
| `vite.config.ts` | Vite config — declares `~/*` → `./src/*` alias and exposes both `VITE_*` and `EXPO_PUBLIC_*` env-prefixes to the client bundle. |
| `tsconfig.json` | Single root TS config covering `src/`, `server/`, `scripts/`, `tests/`, `vite.config.ts`, `vitest.config.ts`, `vitest.setup.ts`. Excludes `packages/` (each package has its own tsconfig). |
| `e2e/` | Playwright E2E test scaffold (not active). |
| `public/` | Static assets served by Vite (`manifest.json`, `robots.txt`, etc.). |
| `index.html` | Vite entry HTML; loads `/src/main.tsx`. |
| `netlify.toml` | Netlify build + SPA rewrite config (publishes `dist/`). |
| `sst.config.ts` | SST v3 infrastructure-as-code (ECS, CloudFront, Lambda, secrets). Optional deployment path. |

## Pre-migration archive

The Expo Router + Tamagui + React Native version of the project is preserved on the `archive/expo-tamagui` branch and the `pre-web-migration-2026-04-30` tag. The `app/`, `ios/`, `android/`, `src/features/`, `src/interface/`, and `src/tamagui/` directories no longer exist on `main`.
