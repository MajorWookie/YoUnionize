# CLAUDE.md — YoUnion

> Last updated: 2026-03-20
> Last updated by: AI session (Voyage AI embedding migration — OpenAI → Voyage AI, 1536→1024 dims, input_type support)

## Project Overview

YoUnion is a cross-platform application (iOS-first, then Android, then Web) for analyzing SEC filings with AI-powered summarization and compensation fairness insights. It ingests SEC EDGAR data, generates AI summaries via Claude, and provides RAG-based Q&A — helping users understand executive compensation relative to their own.

## Tech Stack

- **Runtime**: Bun 1.2 (package manager, runtime, bundler)
- **Framework**: Expo Router 6.x (file-based routing for React Native + Web)
- **UI**: Tamagui 2.0.0-rc.15 (cross-platform design system — native views on mobile, web on browser)
- **Database**: PostgreSQL via Supabase (local dev) / hosted Supabase (staging/prod)
- **ORM**: Drizzle ORM 0.40 (query builder only, no drizzle-kit), postgres-js driver
- **Vector Search**: pgvector extension (1024-dim embeddings for RAG via Voyage AI)
- **Auth**: Supabase Auth (email/password, managed externally)
- **AI**: Anthropic Claude via @anthropic-ai/sdk 0.39
- **Embeddings**: Voyage AI (voyage-4-lite for dev, voyage-finance-2 for prod), 1024 dimensions
- **SEC Data**: sec-api.io (filings, XBRL, company search)
- **API Layer**: Supabase Edge Functions (Deno runtime, 17 endpoints)
- **Background Jobs**: PostgreSQL-backed job queue + AWS Lambda workers (SST v3)
- **Validation**: Valibot 1.0 (NOT Zod)
- **Linting**: oxlint + oxfmt (NOT ESLint/Prettier)
- **Testing**: Vitest (unit), Playwright (E2E — scaffolded, not active)
- **Deployment**: SST v3 on AWS (static SPA + Lambda) + Supabase Edge Functions
- **Env Management**: dotenvx, `.env` / `.env.example`
- **Charts**: react-native-svg (custom SVG-based PieChart, SunburstChart — no external charting library)
- **Markdown**: react-native-markdown-display 7.x (cross-platform markdown rendering in filing summaries)
- **Icons**: Phosphor (phosphor-react for web, phosphor-react-native for mobile)

### Stack Confidence Notes

| Layer | Tool | Docs | Confidence |
|-------|------|------|------------|
| Runtime | Bun 1.2 | https://bun.sh/docs | Reasonably well-documented. Check version-specific APIs. |
| Framework | Expo Router 6.x | https://docs.expo.dev/router | Well-documented, mature, large community. |
| UI | Tamagui 2.0-rc | https://tamagui.dev/docs | Good docs, but compiler has edge cases. |
| ORM | Drizzle 0.40 | https://orm.drizzle.team/docs | Solid docs, but Bun-specific integration has known bugs. |
| API Layer | Supabase Edge Functions | https://supabase.com/docs/guides/functions | Well-documented. Runs on Deno. |
| Auth | Supabase Auth | https://supabase.com/docs | Well-documented. API keys are transitioning — verify key format. |
| AI | Anthropic Claude | https://docs.anthropic.com | Well-documented. Use for summarization/RAG features. |
| Embeddings | Voyage AI | https://docs.voyageai.com/docs/embeddings | Well-documented. REST API similar to OpenAI. Use `input_type` param. |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Expo Router (React Native + Web)            │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  app/ (routes)   │  │  src/ (features, db, ui)     │  │
│  │  - _layout.tsx   │  │  - database/schema+validators│  │
│  │  - index.tsx     │  │  - features/auth, company,   │  │
│  │  - sign-in.tsx   │  │    onboarding                │  │
│  │  - sign-up.tsx   │  │  - interface/ (UI, charts,   │  │
│  │  - (app)/        │  │    display)                  │  │
│  │    company/      │  │  - lib/ (api-client)         │  │
│  │      [ticker]/   │  │                              │  │
│  └─────────────────┘  └──────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│     supabase/functions/ (Edge Functions — Deno)          │
│  17 API endpoints: health, user, companies, ask, etc.    │
│  _shared/: db, auth, cors, schema, api-utils,            │
│            sec-fetch, sec-ingest                          │
├─────────────────────────────────────────────────────────┤
│                   packages/ (workspace)                   │
│  @union/ai       — Claude API wrapper + prompts           │
│  @union/postgres  — Drizzle DB client (postgres-js)       │
│  @union/sec-api   — SEC EDGAR API client + schemas        │
│  @union/helpers   — Shared utilities (ensureEnv, types,   │
│                     concurrency, normalizeName)           │
│  @union/hooks     — React hooks (useAuth, useDebounce)    │
├─────────────────────────────────────────────────────────┤
│  src/server/lambda/ — AWS Lambda workers (SST v3)         │
│  - ingestion.handler  (long-running SEC + AI jobs)        │
│  - migrate.handler    (⚠️ STALE — refs removed Drizzle migrations) │
└─────────────────────────────────────────────────────────┘
         │                    │                  │
    Supabase Auth      PostgreSQL + pgvector    SEC API
    (managed)          (Drizzle ORM)            (sec-api.io)
```

### Module Map

| Directory | Responsibility |
|-----------|---------------|
| `app/` | File-based routing (Expo Router). Pages and layouts. **Note:** Legacy `app/api/` routes from One Framework still exist and use the old in-memory job queue — these should be removed (see tech debt). |
| `app/api/` | ⚠️ **Legacy** — 14 One Framework `+api.ts` routes still present. Superseded by Edge Functions but not yet deleted. Still reference old in-memory job queue. |
| `supabase/functions/` | 17 Supabase Edge Functions (Deno) — health, user-me, user-profile, user-cost-of-living, companies-lookup, companies-search, companies-search-sec, company-detail, company-fetch, company-ingest (⚠️ legacy — superseded by company-fetch + company-process), company-process, company-summarize, company-summary-status, compensation-fairness, ask, batch-fetch, job-status |
| `supabase/functions/_shared/` | Shared Edge Function utilities: db, auth, cors, schema, api-utils, sec-fetch (SEC API call helpers), sec-ingest (lightweight DB insert for directors/compensation) |
| `src/database/schema/` | Drizzle ORM table definitions (companies, filings, exec comp, directors, insider trades, embeddings, jobs, raw-sec-responses, form-8k-events) |
| `src/database/validators/` | Valibot schemas for insert validation |
| `supabase/migrations/` | SQL migrations (applied via `supabase db reset`) |
| `src/features/auth/` | Supabase client creation (server + client) and `ensureAuth()` |
| `src/features/ask/` | RAG Q&A UI (AskBar component) |
| `src/features/company/` | Company detail types, formatting utilities, section components (LeadershipSection, CeoSpotlightCard, ExecutiveSummaryCard, TextSummaryCard, IncomeStatementSunburst, IncomeBreakdownChart, IngestionPrompt), and data extraction utilities |
| `src/features/company/lib/` | Data extraction utilities — `income-data-extractor.ts` (XBRL income statement parser → sunburst chart data) |
| `src/features/onboarding/` | Constants for user profile (org levels, pay frequencies, CoL categories) |
| `src/interface/` | Shared UI components (ScreenContainer, ErrorBoundary, ToastProvider) |
| `src/interface/charts/` | SVG-based chart components — `PieChart.tsx` (donut chart), `SunburstChart.tsx` (multi-ring concentric chart with tap interaction) |
| `src/interface/display/` | Display components — `MarkdownContent.tsx` (cross-platform markdown renderer using Tamagui theme tokens) |
| `src/server/` | Server-side utilities (api-utils, job-queue, job-queue-db, ai-client, sec-api-client) |
| `src/server/services/` | Business logic: ingestion pipelines (filing, compensation, directors, insider trading), XBRL transform, summarization, sec-fetcher (Phase 1 raw fetch), raw-data-processor (Phase 2 domain processing) |
| `src/server/services/enrichment/` | Compensation and director enrichment functions (post-fetch processing) |
| `scripts/` | Utility scripts: `seed-companies.ts` (run via `bun run seed` / `bun run seed:no-ai`) |
| `src/lib/` | Client-side utilities (fetchWithRetry API client) |
| `src/tamagui/` | Tamagui config, themes, semantic tokens |
| `src/test/` | Vitest setup and test data factories |
| `packages/ai/` | Anthropic SDK wrapper, Voyage AI embeddings, prompt templates (filing summary, comp analysis, RAG) |
| `packages/postgres/` | Database connection, vector search functions |
| `packages/sec-api/` | SEC API client with Valibot-validated responses |
| `packages/helpers/` | `ensureEnv()`, `normalizeName()`, shared TypeScript types, concurrency utilities (`concurrency.ts`) |
| `packages/hooks/` | `useAuth()` (Supabase), `useDebounce()` |
| `supabase/` | Local Supabase config + migrations |
| `e2e/` | Playwright E2E test scaffold |

### Data Flow

1. **User searches** for a company → Discover screen fires TWO parallel calls: `GET /api/companies/search` (local DB, fast) and, if local results < 3, `GET /api/companies/search-sec` (SEC API search + upsert). Local results display immediately; SEC results are appended asynchronously.
2. **User navigates to company detail** → `GET /api/companies/{ticker}/detail` → if directors or executives are missing from DB, auto-fetches from SEC API (`_shared/sec-ingest.ts`) and stores them before returning. Company detail page renders dashboard sections: income statement sunburst, CEO spotlight, executive summary, leadership (tappable), financials, MD&A, risk factors, 8-K events, etc.
2a. **User taps an executive/director** → navigates to `/company/[ticker]/executive/[id]` → shows full profile with compensation breakdown, committee memberships, qualifications, and dual-role handling.
3. **Phase 1 — SEC fetch** → `POST /api/companies/[ticker]/fetch` → fetches raw SEC API responses (filings, exec comp, insider trades, directors) → stores verbatim JSON in `raw_sec_responses` table
4. **Phase 2 — Processing** → `POST /api/companies/[ticker]/process` → reads from `raw_sec_responses` → transforms and inserts into domain tables (filings, executive_compensation, directors, insider_trades) with enrichment (canonical names, roles)
5. **Summarization triggered** → `POST /api/companies/[ticker]/summarize` → for each unsummarized filing: extracts sections → Claude generates AI summaries → stores in `filing_summaries.aiSummary` → generates 1024-dim embeddings via Voyage AI (`input_type: 'document'`) → stores in `embeddings` table
6. **User asks a question** → `POST /api/ask` → embeds question via Voyage AI (`input_type: 'query'`) → vector search on embeddings → retrieves relevant filing context → Claude generates RAG answer with citations
7. **Compensation analysis** → `POST /api/analysis/compensation-fairness` → combines user profile (salary, CoL, org level) with company exec comp data → Claude generates fairness analysis

## Conventions

### Naming
- **Files**: kebab-case for utilities (`api-client.ts`), PascalCase for components (`ScreenContainer.tsx`), dot-separated for domain files (`sec-api.schemas.ts`)
- **Functions**: camelCase, verb-first (`ingestFilings`, `summarizeSection`, `transformXbrl`)
- **Types/Interfaces**: PascalCase, no prefix (`CompanyRecord`, `FilingSummary`)
- **Database tables**: snake_case, plural (`filing_summaries`, `insider_trades`)
- **Constants**: UPPER_SNAKE_CASE for env vars, camelCase arrays/objects (`orgLevels`, `payFrequencies`)

### Patterns
- **Dependency versions**: Fix version mismatches by updating versions directly in `package.json` — never use `overrides` or `resolutions` as a workaround. Expo SDK versions must stay aligned with `bundledNativeModules.json` (check the `expo` package or Expo SDK changelog for compatible versions).
- **Validation**: Valibot schemas co-located in `src/database/validators/`. Every POST/PUT body validated before processing.
- **API routes**: `withLogging()` wrapper + `classifyError()` for standardized error responses. All protected routes use `ensureAuth()`.
- **Error handling**: Try-catch at API boundary, `Promise.allSettled()` for parallel operations, errors accumulated not thrown in services.
- **State management**: Minimal — auth state via `useAuth()` hook, no global store yet.
- **Exports**: Named exports only. Index files are re-export barrels — no logic.
- **Logging**: `console.info()` only (never `console.log()`).
- **Type safety**: No `any` — use `unknown` with type guards. Explicit return types on exported functions.

### Visualization & Display
- **SVG charts**: Built with `react-native-svg` — no external charting libraries. Custom geometry helpers (`polarToCartesian`, `arcPath`, `annularSectorPath`) in chart components. Minimum arc width enforcement (7.2°) prevents tiny slices from disappearing.
- **Markdown rendering**: `MarkdownContent` component wraps `react-native-markdown-display`, styled with Tamagui theme tokens. Used for AI-generated content (MD&A, risk factors, legal proceedings, 8-K summaries). Enable via `markdown` prop on `TextSummaryCard`.
- **Income data extraction**: `src/features/company/lib/income-data-extractor.ts` classifies XBRL line items into 17 categories via regex, then builds multi-ring sunburst datasets. Handles edge cases: operating loss, net loss, negative non-operating items, bank vs. manufacturing income structures.

### Name Normalization & Deduplication
- **`normalizeName()`** in `@union/helpers` — lowercase, trim, strip honorific suffixes (Jr., Sr., II–V, Esq., Ph.D., M.D., CPA). Used for deduplication of people across filings.
- **Database columns**: `normalized_name` on both `directors` and `executive_compensation` tables (added in `20260320000000_normalized_name.sql`).
- **Dedup indexes**: `directors_dedup_idx` (company_id, normalized_name) and `exec_comp_dedup_idx` (company_id, normalized_name, fiscal_year) prevent duplicate inserts from overlapping proxy filings.
- **Sync requirement**: The SQL migration and `normalizeName()` helper use the same regex pattern — keep them in sync.

### Styling (Tamagui)
- Use `styled()` for component variants. Don't mix with inline `style` props unless overriding for a one-off case.
- Use design tokens from `src/tamagui/tamagui.config.ts` — never hardcode colors, spacing, or font sizes.
- For responsive layouts, use Tamagui's media queries, not platform-specific checks.
- For platform-specific behavior, use `.native.tsx` and `.web.tsx` file extensions per Expo Router conventions — don't use `Platform.OS` checks inline.

### Database (Drizzle)
- Schema files: one file per domain/table group in `src/database/schema/`.
- Use `snake_case` for table and column names.
- Explicit types for all columns — don't rely on inference for anything touching the database.
- Relations go in `src/database/relations.ts`, not inline with table definitions.
- Migrations are plain SQL in `supabase/migrations/` (timestamp-prefixed). Apply locally with `supabase db reset`. drizzle-kit has been removed.

### AI/API Patterns
- Claude API calls centralized in `packages/ai/` — don't scatter API calls across components.
- Embeddings use Voyage AI (`voyage-4-lite` for dev, `voyage-finance-2` for prod). Always pass `input_type: 'document'` when storing and `input_type: 'query'` when searching — this asymmetric encoding improves retrieval quality.
- The `/ask` Edge Function calls Voyage AI directly (not through `ClaudeClient`) because Edge Functions run on Deno and can't import the Node-based `@union/ai` package.
- Always handle API rate limits explicitly with retry logic and exponential backoff.
- RAG pipeline components (embedding, retrieval, generation) must be clearly separated — no monolithic "do everything" functions.

### File Organization
- One concept per file
- Tests co-located next to source (`.test.ts` suffix) or in `__tests__/` directories
- Types co-located with implementation
- Server-only code in `src/server/` and `src/features/*/server/`
- Client-only code in `src/features/*/client/` and `src/lib/`

## Architecture Decision Records (ADRs)

### ADR-001: Tamagui over Mantine for UI
- **Date**: 2026-03-14
- **Decision**: Stay on Tamagui 2.0 for cross-platform UI
- **Rationale**: App is iOS-first → Android → Web. Mantine/Chakra/Radix are web-only and cannot render native views. Tamagui provides native components on mobile and web components on browser from a single codebase.
- **Alternatives considered**: Mantine v8 (rejected — web-only), NativeWind, Gluestack UI
- **Status**: active

### ADR-002: Supabase over Better Auth
- **Date**: 2026-03-16
- **Decision**: Migrate from Better Auth to Supabase for authentication and user management
- **Rationale**: Supabase provides managed auth with email/password, social login, and RLS — reducing custom auth code and security surface area.
- **Alternatives considered**: Better Auth (migrated away from), Clerk, Auth0
- **Status**: active

### ADR-003: Valibot over Zod for validation
- **Date**: 2026-03-13
- **Decision**: Use Valibot for all runtime schema validation
- **Rationale**: Smaller bundle size than Zod, tree-shakeable, same type-inference capabilities. Important for a cross-platform app shipping to mobile.
- **Alternatives considered**: Zod
- **Status**: active

### ADR-004: oxlint/oxfmt over ESLint/Prettier
- **Date**: 2026-03-13
- **Decision**: Use Rust-based oxlint and oxfmt for linting and formatting
- **Rationale**: Significantly faster than ESLint/Prettier. Adequate rule coverage for project needs.
- **Alternatives considered**: ESLint + Prettier
- **Status**: active

### ADR-005: PostgreSQL-backed job queue + Lambda workers
- **Date**: 2026-03-17
- **Decision**: Replace in-memory job queue with PostgreSQL `jobs` table + Lambda workers
- **Rationale**: Edge Functions are stateless (no in-memory state). Jobs are now persisted in PostgreSQL with atomic claiming. Long-running operations (ingestion, summarization) are processed by Lambda workers with 900s timeout.
- **Previous**: In-memory Map (ADR-005 original, 2026-03-13) — replaced due to job loss on restart.
- **Migration status**: ⚠️ **Partial** — Edge Functions use DB-backed queue (`src/server/job-queue-db.ts`), but legacy `app/api/` routes still import the old in-memory queue (`src/server/job-queue.ts`). Full migration blocked on deleting legacy API routes.
- **Status**: active (partially implemented)

### ADR-006: Expo Router over One Framework
- **Date**: 2026-03-17
- **Decision**: Migrate from One Framework/VXRN to Expo Router for frontend routing
- **Rationale**: One Framework's native bridge (VXRN) caused opaque iOS build failures, had sparse docs, and small community. Expo Router is mature, well-documented, and provides all the same routing features. The only One-specific feature (API routes) is now handled by Supabase Edge Functions.
- **Alternatives considered**: One Framework (migrated away from), React Navigation standalone
- **Status**: active

### ADR-008: Supabase Migrations as Single Source of Truth
- **Date**: 2026-03-18
- **Decision**: Use Supabase migrations (`supabase/migrations/`) as the sole migration system. Remove drizzle-kit.
- **Rationale**: Two competing migration systems (Supabase + Drizzle) caused tables to never be created in the local DB, breaking auth signup. Drizzle ORM remains as the query builder for type-safe database access; only the migration generator (drizzle-kit) is removed. Future schema changes are written as plain SQL in `supabase/migrations/` with timestamp-prefixed filenames. Apply locally with `supabase db reset`.
- **Alternatives considered**: Keeping drizzle-kit as a SQL generation helper (rejected — adds complexity with no clear benefit for the team size)
- **Status**: active

### ADR-007: Supabase Edge Functions for API layer
- **Date**: 2026-03-17
- **Decision**: Move all API endpoints from One's `+api.ts` routes to Supabase Edge Functions (Deno)
- **Rationale**: API logic shouldn't live inside the frontend framework. Supabase Edge Functions consolidate on existing Supabase infrastructure, run on Deno (Bun-independent), and deploy independently from the mobile app. Database driver switched from `node-postgres` to `postgres-js` for Deno compatibility.
- **Alternatives considered**: Standalone Bun/Hono server, AWS Lambda API Gateway
- **Status**: active

### ADR-009: Decouple SEC Data Fetching from LLM Processing
- **Date**: 2026-03-18
- **Decision**: Restructure the ingestion pipeline into two independent phases: (1) Fetch and store all raw SEC API responses verbatim in `raw_sec_responses` table, (2) Process raw data through transformers and LLMs as a separate step.
- **Rationale**: Current interleaved design means re-running LLM summarization requires re-fetching from SEC API, wastes API quota, and loses data that current transformers discard. Decoupling enables: re-processing without re-fetching, preserving all API data for future use, and batch operations across multiple companies.
- **New tables**: `raw_sec_responses` (verbatim API data lake), `form_8k_events` (structured 8-K events)
- **New endpoints**: `company-fetch` (Phase 1), `company-process` (Phase 2), `batch-fetch` (batch operations)
- **Bug fixes included**: Directors schema corrected (nested `data[].directors[]`), insider trading `totalValue` cents→dollars fix, derivative transactions now captured
- **Alternatives considered**: Extending `filing_summaries.rawData` (rejected — compensation/directors are per-company, not per-filing), S3 for raw storage (rejected — responses are JSON under 1MB, TOAST handles well)
- **Status**: active

## Known Tech Debt

- [ ] **In-memory job queue partially replaced** — Edge Functions use PostgreSQL `jobs` table (ADR-005), but legacy `app/api/` routes still import the old in-memory `src/server/job-queue.ts`. DB-backed replacement exists at `src/server/job-queue-db.ts`. Full cleanup requires deleting `app/api/` routes. Priority: **high**.
- [x] **~~Dual migration systems~~** — Consolidated to Supabase migrations only. drizzle-kit removed, stale Drizzle migrations deleted (2026-03-18).
- [ ] **Lambda migrate handler is stale** — `src/server/lambda/migrate.ts` imports from `drizzle-orm/node-postgres/migrator` and references `./src/database/migrations` (non-existent). Per ADR-008, migrations are now in `supabase/migrations/`. This handler will fail at deploy. Needs rewrite or removal. Priority: **high**.
- [ ] **Legacy `app/api/` routes not deleted** — 14 One Framework `+api.ts` files remain in `app/api/`. Per ADR-007, all API logic moved to Edge Functions. These are dead code but confusing. Priority: **medium**.
- [ ] **SST config references One Framework** — `sst.config.ts` still sets `ONE_SERVER_URL` env var. Should be removed or renamed post-migration. Priority: **low**.
- [ ] **Duplicate type definitions** — `FinancialLineItem`, `FinancialStatement` defined in both `src/server/services/xbrl-transformer.ts` and `src/features/company/types.ts`. `ExecCompSummary` now also in `src/features/company/types.ts`. Should be extracted to a shared location. Priority: **medium**.
- [ ] **No rate limiting on API endpoints** — RAG queries and compensation analysis are computationally expensive with no throttling. Priority: **high before prod**.
- [ ] **No structured logging** — All logging via `console.info()` with no request IDs, user context, or JSON structure. Hard to search in production. Priority: **medium**.
- [ ] **Tamagui v2.0.0-rc.15 is pre-release** — API may change. Monitor for stable release. Priority: **low** (works currently).
- [ ] **CI type-check allows pre-existing errors** — Tamagui TS2322 errors are tolerated, masking potential new type errors. Priority: **medium**.
- [ ] **No E2E tests in CI** — Playwright scaffolded but no test files or CI integration. Priority: **medium**.
- [ ] **No SAST/dependency scanning** in CI pipeline. Priority: **medium**.
- [ ] **Email confirmations disabled** in Supabase auth config — anyone can sign up with any email. Priority: **high before prod**.
- [ ] **API client error parsing** — `fetchWithRetry()` assumes JSON error responses; HTML error pages (502) will cause secondary parse failures. Priority: **low**.
- [ ] **Summarization text chunking** — Hardcoded 4 chars/token ratio is approximate; overlap of 50 tokens may lose context at chunk boundaries. Priority: **low**.
- [ ] **Valibot `v.object()` silently strips undeclared keys** — SEC API responses contain fields not in our Valibot schemas, which are silently dropped during validation. This causes data loss in `raw_sec_responses` and domain tables. Detailed plan in `PLAN-8K-ITEMS-FIX.md`. Priority: **high**.
- [ ] **`company-ingest` Edge Function is legacy** — Superseded by the 2-phase `company-fetch` + `company-process` per ADR-009. Should be removed alongside legacy `app/api/` cleanup. Priority: **medium**.

## Environment Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd YoUnion
bun install

# 2. Set up environment
cp .env.example .env
# Edit .env with your SEC_API_KEY, ANTHROPIC_API_KEY, and VOYAGE_API_KEY

# 3. Start local Supabase (requires Docker + Supabase CLI)
supabase start

# 4. Apply database migrations (resets local DB and replays all migrations)
bun run supabase:migrate   # runs: supabase db reset

# 5. Start dev server
bun dev
# Opens Expo dev server (press w for web, i for iOS simulator)

# Edge Functions local dev (in a separate terminal):
bun run dev:functions

# iOS development (requires Xcode):
bun run prebuild   # generates native projects
bun run ios        # starts iOS dev build

# Android development:
bun run android
```

### Key ports (local Supabase)
- API: `http://127.0.0.1:54321`
- Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`

## Testing Strategy

- **Unit tests**: Vitest, run with `bun test` or `bun run test:unit`
- **Test location**: Co-located `.test.ts` files or `__tests__/` directories
- **Test setup**: `src/test/setup.ts` (env defaults), `src/test/factories.ts` (data factories)
- **Current coverage**: ~13 test suites — api-utils, xbrl-transformer, compensation-math, api-client, ensureAuth, AI prompts (claude, prompts), sec-api, helpers (ensureEnv), enrichment (compensation-name, director-role), company format
- **Not tested**: Ingestion services, summarization pipeline, database operations, React components
- **E2E**: Playwright config exists at `e2e/playwright.config.ts` but no test files written yet
- **CI**: Lint → type-check → unit tests on every PR (`.github/workflows/ci.yml`)

## Gotchas and Footguns

### Project-Specific
- **Supabase must be running before `bun dev`**: The dev script runs `supabase start && npx expo start`. If Supabase isn't installed or Docker isn't running, dev fails silently or with a confusing error.
- **`authClient.ts` silently falls back to localhost**: If `EXPO_PUBLIC_SUPABASE_URL` is missing, the Supabase client connects to `127.0.0.1:54321`. Fine for dev, dangerous if this somehow ships to production.
- **Edge Functions use Deno, not Bun**: The `supabase/functions/` directory runs on Deno runtime. Use `Deno.env.get()` instead of `process.env`. The shared schema is duplicated in `supabase/functions/_shared/schema.ts` — keep it in sync with `src/database/schema/`.
- **API URL routing**: Frontend calls still use `/api/*` paths, which are transparently mapped to Edge Function URLs by `src/lib/api-base.ts`. Dynamic segments become query params (e.g., `/api/companies/AAPL/detail` → `/functions/v1/company-detail?ticker=AAPL`).
- **SEC API rate limiting**: sec-api.io has rate limits. The client handles 429s, but bulk ingestion of many companies in sequence can hit them. Space out requests.
- **pgvector extension**: Must be enabled in Supabase. Local Supabase has it by default, but verify it's enabled in hosted Supabase before deploying.

### Bun + Drizzle ORM
- **drizzle-kit requires Node.js under the hood.** Even though the runtime is Bun, `drizzle-kit` commands (generate, push, migrate) use Node internally. Cryptic errors like `require() async module is unsupported` come from this. Always ensure Node.js is installed alongside Bun for migration tooling.
- **Bun SQL concurrent statement issues.** Bun v1.2.x has known issues with concurrent SQL statements through `drizzle-orm/bun-sql`. Intermittent query failures under load are likely a Bun issue, not Drizzle.
- **JSON column type bug with Bun.** `Object.getPrototypeOf(value)` returns `null` in Bun for values from the SQL driver, breaking Drizzle's entity checking for JSON columns. Workaround: serialize/deserialize JSON manually rather than relying on automatic JSON handling.
- **Don't use Bun-specific imports in schema files.** `import { randomUUIDv7 } from 'bun'` in Drizzle schema files breaks `drizzle-kit generate` because kit runs under Node. Use `crypto.randomUUID()` or portable alternatives.
- **Date/timestamp handling.** The `bun-sql` driver has had bugs with date mapper returns. Always verify dates round-trip correctly. If dates come back as strings when you expect Date objects, check the Drizzle changelog.

### Tamagui
- **Compiler optimization has limits.** Tamagui's static compiler cannot optimize: dynamic styles depending on runtime values, styles spread from variables crossing module boundaries, or components using certain hook patterns inside `styled()`. If optimization doesn't work, the runtime fallback is fine. Don't fight it.
- **TS2322 type errors.** These may appear due to Tamagui's prop types. CI tolerates them. Don't suppress real type errors thinking they're Tamagui issues — but also don't chase Tamagui-specific type errors that don't affect runtime.
- **Keep `tamagui.config.ts` as a separate file.** The compiler needs it separate (not inlined) for optimization. Don't move config inline.
- **Dark mode uses React Native's `useColorScheme()`** — see `src/tamagui/TamaguiRootProvider.tsx`.

### Supabase
- **API keys are transitioning.** Supabase is moving from legacy `anon`/`service_role` keys to new `publishable`/`secret` keys (format: `sb_publishable_xxx`). Both work during transition, but new keys behave differently — they can't be used as JWTs. Before touching auth or API config, check which key format the project uses.
- **Realtime pulls in WebSocket/Node dependencies.** `@supabase/supabase-js` bundles Realtime support which depends on `stream` and `ws`. In React Native/One native builds, this **will crash** with `attempted to import the Node standard library module "stream"`. If not using Realtime, disable it in client config or import only Auth/Database clients directly.
- **Realtime subscriptions leak memory if not cleaned up.** Every channel subscription must be unsubscribed on component unmount. Missing cleanup → doubled subscriptions and memory leaks. Always use cleanup returns in `useEffect` for `.on()` subscriptions.
- **RLS is your responsibility.** Supabase exposes PostgreSQL directly to the client via PostgREST. Misconfigured RLS policies expose all rows to all users. This is a **Level 3 escalation zone**.
- **Do NOT mix Supabase Auth with other auth systems.** The project previously used Better Auth — that migration is complete. All auth now goes through Supabase Auth exclusively.

### Expo Router
- **File-system routing in `app/`**: Layouts use `_layout.tsx`, pages are `index.tsx` or `[param].tsx`. Platform-specific layouts use `.native.tsx` suffix. Nested directory routes (e.g., `app/(app)/company/[ticker]/`) use their own `_layout.tsx` for stack navigation within that section.
- **Entry point**: `package.json` must have `"main": "expo-router/entry"` for the app to load correctly.
- **`useLocalSearchParams` not `useParams`**: Expo Router uses `useLocalSearchParams<T>()` for route params, not `useParams<T>()`.
- **Web SPA mode**: App renders as a single-page application on web. No SSR.

### Supabase Edge Functions
- **Deno runtime**: Edge Functions run on Deno, not Bun/Node. Use `Deno.env.get()` and `Deno.serve()`.
- **CORS required**: Every Edge Function must handle `OPTIONS` preflight and include CORS headers. Use `_shared/cors.ts`.
- **150s timeout (free) / 400s (Pro)**: Long-running operations (summarization) must use Lambda workers, not Edge Functions.
- **Schema duplication**: `supabase/functions/_shared/schema.ts` mirrors `src/database/schema/`. Keep them in sync when modifying tables.
- **Ingestion logic duplication**: `supabase/functions/_shared/sec-ingest.ts` mirrors column mappings from `src/server/services/directors-ingestion.ts` and `compensation-ingestion.ts`. Keep both in sync when changing director or compensation fields. The `_shared` version skips enrichment (roles, canonical names) — that runs during full pipeline ingestion. Both now include `normalizedName` via `@union/helpers`.

## Version Verification Protocol

This stack moves fast. **Before using any API from these libraries, check `package.json` for the installed version:**

- **Bun**: `bun --version` or check runtime
- **Expo / Expo Router**: `package.json` → `expo` and `expo-router` versions
- **Tamagui**: `package.json` → `tamagui` version
- **Drizzle**: `package.json` → `drizzle-orm` version (drizzle-kit removed per ADR-008)
- **Supabase**: `package.json` → `@supabase/supabase-js` version (also check API key format in `.env`)
- **Anthropic**: `package.json` → `@anthropic-ai/sdk` version

If the version is **older** than what you're trained on — do NOT assume latest APIs exist. Use what's documented for that version, or escalate with Level 1.

If the version is **newer** than what you're trained on — issue Level 1: *"This version may have APIs I'm not aware of. Verify at [docs URL] before committing to this approach."*

## Stack-Specific Escalation Triggers

In addition to Layer 1's general escalation rules, **always escalate** in this stack when:

| Situation | Level |
|-----------|-------|
| Modifying `tamagui.config.ts` or Tamagui compiler settings | Level 1 |
| Writing or modifying Supabase migrations | Level 1 |
| Bun-specific APIs (`Bun.serve`, `Bun.file`, `bun:sqlite`, etc.) | Level 1 |
| Claude API integration (RAG pipeline, embeddings, prompting) | Level 1 |
| Cross-platform divergence (web vs. native behavior) | Level 1 |
| Supabase Edge Function schema changes (keep _shared/schema.ts in sync) | Level 1 |
| Supabase Realtime channel setup or subscriptions | Level 1 |
| Supabase API key changes or migration to new key format | Level 2 |
| Supabase RLS policy creation or modification | Level 3 |
| Supabase Auth configuration changes | Level 3 |
| Native build issues (iOS/Android) | Level 2 |

## Documentation Links

When uncertain, point the developer here rather than guessing.

- **Expo Router**: https://docs.expo.dev/router/introduction/
- **Expo Docs**: https://docs.expo.dev
- **Tamagui**: https://tamagui.dev/docs
- **Drizzle ORM**: https://orm.drizzle.team/docs
- **Drizzle + postgres-js**: https://orm.drizzle.team/docs/get-started/postgresql-new
- **Bun Docs**: https://bun.sh/docs
- **Anthropic API**: https://docs.anthropic.com
- **Voyage AI Embeddings**: https://docs.voyageai.com/docs/embeddings
- **Supabase Docs**: https://supabase.com/docs
- **Supabase Auth (React)**: https://supabase.com/docs/guides/auth/quickstarts/react
- **Supabase RLS**: https://supabase.com/docs/guides/database/postgres/row-level-security
- **Supabase API Keys (new format)**: https://supabase.com/docs/guides/api/api-keys
- **Supabase JS Client**: https://supabase.com/docs/reference/javascript/introduction
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Tamagui GitHub**: https://github.com/tamagui/tamagui
- **Drizzle GitHub Issues**: https://github.com/drizzle-team/drizzle-orm/issues
- **Supabase GitHub Issues**: https://github.com/supabase/supabase-js/issues

## Current Active Work

### Completed
- Migrated from One Framework/VXRN to Expo Router (2026-03-17)
- Migrated API routes to Supabase Edge Functions (2026-03-17) — **but legacy `app/api/` routes not yet deleted**
- Migrated Drizzle driver from node-postgres to postgres-js (2026-03-17)
- Decoupled SEC fetch from LLM processing (ADR-009, 2026-03-18) — added 3 new Edge Functions (company-fetch, company-process, batch-fetch)
- DB-first search with SEC fallback (2026-03-20) — Discover screen shows local results instantly, appends SEC results async; company-detail auto-fetches directors/execs from SEC when DB is empty
- LeadershipSection displays both executives (top 5 by comp, deduped) and board of directors
- Enrichment pipeline: compensation canonical name matching (`compensation-name-enrichment.ts`) and director role normalization (`director-role-enrichment.ts`)
- `fetchWithRetry` API client utility with configurable retry/backoff (2026-03-20)
- Concurrency utilities added to `@union/helpers` (`packages/helpers/src/concurrency.ts`)
- Drizzle relations file created at `src/database/relations.ts`
- Nested company routing: `app/(app)/company/[ticker]/` with `_layout.tsx`, `index.tsx`, and `executive/[id].tsx` for executive/director detail pages (2026-03-20)
- SVG chart components: `PieChart` (donut) and `SunburstChart` (multi-ring concentric) in `src/interface/charts/` (2026-03-20)
- Income data extraction: `src/features/company/lib/income-data-extractor.ts` — XBRL income statement → sunburst visualization data (2026-03-20)
- Company detail dashboard sections: CeoSpotlightCard, IncomeStatementSunburst, IncomeBreakdownChart (fallback), ExecutiveSummaryCard (with markdown), TextSummaryCard (with markdown support) (2026-03-20)
- Markdown rendering: `MarkdownContent` component using `react-native-markdown-display` with Tamagui theme tokens (2026-03-20)
- Name normalization and dedup: `normalizeName()` helper, `normalized_name` DB columns + dedup indexes on directors and executive_compensation tables (2026-03-20)
- Expo modules support and privacy information (2026-03-20)
- Migrated embeddings from OpenAI (`text-embedding-3-small`, 1536-dim) to Voyage AI (`voyage-4-lite`, 1024-dim) (2026-03-20) — added `input_type` support (`document` for storage, `query` for search), removed Ollama fallback, migration truncates old embeddings

### In Progress / Remaining
- Job queue partially migrated to PostgreSQL `jobs` table (Edge Functions use DB queue; legacy routes still use in-memory)
- Core data pipeline (SEC ingestion → AI summarization → RAG) is functional
- Compensation fairness analysis feature is functional
- User onboarding flow exists (sign-up, profile, cost-of-living)
- Lambda worker integration for job processing (TODO: wire up SQS trigger)
- Lambda migrate handler needs rewrite to use Supabase migrations instead of removed Drizzle migrations
- Valibot key-stripping data loss fix (see `PLAN-8K-ITEMS-FIX.md`)
- No production deployment yet — local dev and staging only

### Reference Docs (root)
- `LLM-BRIEFING.md` — SEC API & ingestion pipeline deep-dive for AI assistants
- `PLAN-8K-ITEMS-FIX.md` — Draft plan for Valibot schema & pipeline data integrity fixes
- `SEED.md` — Seed script usage reference
