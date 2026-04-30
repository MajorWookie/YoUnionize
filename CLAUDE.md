# CLAUDE.md — YoUnionize

## Project Overview

YoUnionize is a web application for analyzing SEC filings with AI-powered summarization and compensation fairness insights. It ingests SEC EDGAR data, generates AI summaries via Claude, and provides RAG-based Q&A — helping users understand executive compensation relative to their own.

The project was migrated from a cross-platform Expo Router app (iOS-first) to a web-only single-page app in April 2026. The pre-migration snapshot is preserved on the `archive/expo-tamagui` branch and the `pre-web-migration-2026-04-30` tag.

## Tech Stack

- **Runtime**: Bun 1.2 (package manager, runtime, server-side scripts)
- **Build tool**: Vite 7 (web app bundling, dev server)
- **Framework**: React 19 + React Router 7 (client-side SPA)
- **UI**: Mantine 7 (`@mantine/core`, `@mantine/charts`, `@mantine/notifications`, `@mantine/form`, `@mantine/hooks`)
- **Database**: PostgreSQL via Supabase (local dev) / hosted Supabase (staging/prod)
- **ORM**: Drizzle ORM 0.40 (query builder only, no drizzle-kit), postgres-js driver
- **Vector Search**: pgvector extension (1024-dim embeddings for RAG via Voyage AI)
- **Auth**: Supabase Auth (email/password, managed externally)
- **AI**: Anthropic Claude via @anthropic-ai/sdk 0.39
- **Embeddings**: Voyage AI (voyage-4-lite for dev, voyage-finance-2 for prod), 1024 dimensions
- **SEC Data**: sec-api.io (filings, XBRL, company search)
- **API Layer**: Supabase Edge Functions (Deno runtime, ~22 endpoints)
- **Background Jobs**: PostgreSQL-backed job queue
- **Validation**: Valibot 1.0 (NOT Zod)
- **Linting**: oxlint + oxfmt (NOT ESLint/Prettier)
- **Testing**: Vitest (unit), Playwright (E2E — scaffolded, not active)
- **Markdown**: react-markdown 9.x with remark-gfm
- **Charts**: `@mantine/charts` for standard charts; custom React/SVG components in `src/components/charts/` for waterfall, fairness gauge, comparison bar, and the income-statement sunburst.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Web app (Vite + React + Mantine)            │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  src/routes/    │  │  src/components/             │  │
│  │  - home         │  │  - Layout (AppShell.Navbar)  │  │
│  │  - sign-in/up   │  │  - AskBar (RAG entry)        │  │
│  │  - discover     │  │  - LeadershipSection         │  │
│  │  - company      │  │  - CeoSpotlightCard          │  │
│  │  - executive    │  │  - InsiderTradingTable       │  │
│  │  - onboarding   │  │  - charts/{Waterfall,        │  │
│  │  - profile      │  │     FairnessGauge,           │  │
│  │  - my-pay       │  │     ComparisonBar,           │  │
│  │  - my-company   │  │     SunburstChart, ...}      │  │
│  └─────────────────┘  └──────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│            server/ (Bun-only, server-side scripts)       │
│  api-utils, ai-client, sec-api-client, job-queue-db,     │
│  services/{ingestion, summarization, enrichment, ...}    │
├─────────────────────────────────────────────────────────┤
│     supabase/functions/ (Edge Functions — Deno)          │
│  ~22 API endpoints: health, user, companies, ask, etc.   │
│  _shared/: db, auth, cors, schema, api-utils,            │
│            sec-fetch, sec-ingest                          │
├─────────────────────────────────────────────────────────┤
│                   packages/ (workspace)                   │
│  @younionize/ai          — Claude wrapper + prompts      │
│  @younionize/api-client  — fetchWithRetry + error helpers│
│  @younionize/postgres    — Drizzle DB + schema +         │
│                            relations + validators        │
│  @younionize/sec-api     — SEC EDGAR API client + schemas│
│  @younionize/helpers     — Shared utilities              │
│  @younionize/hooks       — React hooks (useAuth,         │
│                            useDebounce)                  │
└─────────────────────────────────────────────────────────┘
         │                    │                  │
    Supabase Auth      PostgreSQL + pgvector    SEC API
    (managed)          (Drizzle ORM)            (sec-api.io)
```

See `docs/MODULE-MAP.md` for detailed module/directory descriptions.

### Data Flow

1. **User searches** → Discover fires TWO parallel calls: `GET /api/companies/search` (local DB) and, if local results < 3, `GET /api/companies/search-sec` (SEC API + upsert). Local results display immediately; SEC results appended async.
2. **Company detail** → `GET /api/companies/{ticker}/detail` → auto-fetches directors/execs from SEC if missing. Dashboard: income sunburst, CEO spotlight, leadership, financials, MD&A, risk factors, 8-K events, insider trades.
3. **Phase 1 — SEC fetch** → `POST /api/companies/[ticker]/fetch` → stores verbatim JSON in `raw_sec_responses`
4. **Phase 2 — Processing** → `POST /api/companies/[ticker]/process` → transforms raw data into domain tables with enrichment
5. **Summarization** → `POST /api/companies/[ticker]/summarize` → routes sections to specialized prompts → stores summaries + 1024-dim Voyage AI embeddings
6. **RAG Q&A** → `POST /api/ask` → Voyage AI embed (`input_type: 'query'`) → vector search (cosine ≥ 0.3) → optional reranking → Claude generates answer
7. **Compensation analysis** → `POST /api/analysis/compensation-fairness` → user profile + exec comp → Claude fairness analysis
8. **Personalized summary** → `POST /api/company-personalize` → cached per-user "what this means for you" via Claude (`claude-haiku-4-5`)

## Conventions

### Naming
- **Files**: kebab-case for utilities (`api-client.ts`), PascalCase for components (`CeoSpotlightCard.tsx`), dot-separated for domain files (`sec-api.schemas.ts`)
- **Functions**: camelCase, verb-first (`ingestFilings`, `summarizeSection`, `transformXbrl`)
- **Types/Interfaces**: PascalCase, no prefix (`CompanyRecord`, `FilingSummary`)
- **Database tables**: snake_case, plural (`filing_summaries`, `insider_trades`)
- **Constants**: UPPER_SNAKE_CASE for env vars, camelCase arrays/objects (`orgLevels`, `payFrequencies`)

### Patterns
- **Git branching**: Always create a new branch before starting work. Never commit directly to `main`. Branch naming: `fix/<description>` or `feat/<description>`.
- **Dependency versions**: Fix mismatches directly in `package.json` — never use `overrides` or `resolutions`.
- **Validation**: Valibot schemas in `packages/postgres/src/validators/`. Every POST/PUT body validated before processing.
- **API routes**: `withLogging()` wrapper + `classifyError()` for standardized errors. Protected Edge Functions use `ensureAuth()` from `supabase/functions/_shared/auth.ts`.
- **Error handling**: Try-catch at API boundary, `Promise.allSettled()` for parallel ops, errors accumulated not thrown in services.
- **Exports**: Named exports only. Index files are re-export barrels — no logic.
- **Logging**: `console.info()` only (never `console.log()`).
- **Type safety**: No `any` — use `unknown` with type guards. Explicit return types on exported functions.

### UI conventions (Mantine)
- **Layout**: `AppShell` with `Header` (60px) and `Navbar` (240px, breakpoint `sm`) wraps every authenticated route. The Navbar collapses entirely (`collapsed: { mobile: true, desktop: true }`) for unauthenticated users so the sign-in/sign-up pages have no sidebar.
- **Theme tokens**: Defined in `src/theme.ts`. Custom palettes are `navy` (brand), `slate`, `green`, `red`. Mantine's defaults (e.g. `yellow`) remain available — `createTheme` adds custom colors rather than replacing the defaults.
- **Color usage**: Reference colors as `<color>.<shade>` (e.g. `c="navy.6"`, `bg="slate.2"`). Avoid hex literals in components.
- **Notifications**: Use `notifications.show({ message, color })` from `@mantine/notifications`. The `Notifications` provider is mounted once in `src/App.tsx`.
- **Routing**: React Router 7. Use `<Link>` for navigation. Lazy-load heavy routes via `React.lazy` + `Suspense` (see `src/App.tsx`).
- **Auth-gated routes**: Wrap children in `<AuthGuard>` inside the route definition.

### Visualization & Display
- **Standard charts**: `@mantine/charts` (BarChart, DonutChart, LineChart, etc.) for typical visualizations.
- **Custom charts** live in `src/components/charts/`:
  - `FairnessGauge` — Mantine `RingProgress` wrapper for 0–100 scores with score-band coloring.
  - `WaterfallChart` — horizontal-bar list for income → taxes → expenses → savings → net flow.
  - `ComparisonBar` — two-segment split bar (e.g. buys vs. sells).
  - `SunburstChart` — custom SVG (radial treemap, used by the income-statement sunburst).
- **Markdown**: `MarkdownContent` wraps `react-markdown` with `remark-gfm` and Mantine theme tokens. Use the `markdown` prop on `TextSummaryCard` to render rich content.
- **Currency convention**: All monetary values flowing through the web app are **raw dollars** (not cents). The API returns dollars; the UI displays dollars; profile/pay edits write dollars. (See `docs/TECH-DEBT.md` for the historical cents-vs-dollars drift inherited from the Expo era.)

### Database (Drizzle)
- Schema lives in `packages/postgres/src/schema/`, one file per domain. Use `snake_case` for table/column names.
- Validators: `packages/postgres/src/validators/` (Valibot). Re-exported via `@younionize/postgres`.
- Relations: `packages/postgres/src/relations.ts`.
- Migrations: plain SQL in `supabase/migrations/` (timestamp-prefixed). Apply with `supabase db reset`.

### Name Normalization & Deduplication
- **`normalizeName()`** in `@younionize/helpers` — lowercase, trim, strip honorific suffixes. Used for people dedup across filings.
- **`getCanonicalFirstName()`** in `@younionize/helpers` — maps nicknames to formal names (e.g., "Bill" → "William") via static `nickname-map.ts`. Used in enrichment layer only (not in `normalizeName()`) to avoid false positives in dedup indexes.
- **Dedup indexes**: `directors_dedup_idx` (company_id, normalized_name) and `exec_comp_dedup_idx` (company_id, normalized_name, fiscal_year).
- **Sync requirement**: The SQL migration and `normalizeName()` helper use the same regex — keep them in sync.

### AI/API Patterns
- Claude API calls centralized in `packages/ai/` — don't scatter across components.
- **Prompt templates** in `packages/ai/src/prompts/` — one file per prompt, 8th-grade reading level, define financial terms. See `docs/PROMPTS.md` for the full prompt map, dispatch table, and per-section vs. rollup grain.
- **Per-section grain**: AI summaries for individual SEC items live on `filing_sections.ai_summary`; filing-level rollups (executive_summary, employee_impact, XBRL statements, 8-K event_summary) live on `filing_summaries.ai_summary`. Dispatch is owned by `packages/sec-api/src/section-prompts.ts`.
- **Summary versioning**: `CURRENT_SUMMARY_VERSION = 2` in `packages/ai/src/types.ts` gates the rendered shape. `PROMPT_VERSIONS` in `packages/sec-api/src/section-prompts.ts` is finer-grained — bump the per-kind suffix (e.g. `risk_factors@v1` → `@v2`) to invalidate just that prompt's rows for re-summarization.
- **ClaudeClient methods**: `summarizeSection()`, `summarizeMda()`, `generateCompanySummary()`, `generateEmployeeImpact()`, `generateFilingSummary()`, `generateWhatThisMeans()`, `generateCompensationAnalysis()`, `ragQuery()`, `generateEmbedding()`. All chat methods use exponential backoff with ±25% jitter (5 retries; honors `retry-after` on 429, also handles 529). Default model `claude-haiku-4-5`.
- **`extractJson()`** in `@younionize/ai` — parses JSON from Claude responses, handling markdown fences and prose wrapping. Used by every JSON-returning prompt: `company-summary`, `employee-impact`, `compensation-analysis`, `filing-summary`.
- **Edge Function prompt duplication**: `/ask`, `/company-personalize`, and `/compensation-fairness` instantiate `Anthropic` directly (Deno can't import Bun packages) and inline their system prompts. The matching `rag-answer.ts`, `what-this-means.ts`, `compensation-analysis.ts` files in `packages/ai/` are not loaded at runtime by those endpoints — keep both copies in sync when editing. Note: the Edge Function `compensation-fairness` uses a 1–10 fairness scale, while the package's `compensation-analysis.ts` uses 1–100.
- **Embeddings**: always pass `input_type: 'document'` when storing, `input_type: 'query'` when searching.
- The `/ask` Edge Function calls Voyage AI directly for embedding AND `Anthropic` directly for generation (not `ClaudeClient`) because Edge Functions run on Deno.
- RAG pipeline components (embedding, retrieval, generation) must be clearly separated.

### File Organization
- One concept per file. Tests co-located (`.test.ts` or `__tests__/`). Types co-located with implementation.
- Web-only: `src/`. Server-only: `server/`. Workspace packages: `packages/*`. Edge Functions: `supabase/functions/`.

## Architecture Decisions

Documented in `docs/adrs/`. Key active decisions: Mantine (post-migration UI), Valibot (not Zod), Supabase Auth, Vite + React Router (post-migration framework), Edge Functions for API, Supabase migrations only (no drizzle-kit), 2-phase SEC fetch/process pipeline.

The pre-migration ADRs around Tamagui and Expo Router are preserved for historical context but no longer reflect the active stack.

## Testing

- **Unit tests**: Vitest — `bun test` or `bun run test:unit`
- **Test setup**: `vitest.setup.ts` (env defaults), `tests/factories.ts` (data factories shared across server tests)
- **Coverage**: Tests live in `packages/*` and `server/`. Web-side React components are not currently unit-tested; smoke-test in the browser instead.
- **Not tested**: Summarization pipeline (end-to-end), live DB operations, React components, Edge Function handlers.
- **CI**: Lint → type-check → unit tests on every PR (`.github/workflows/ci.yml`)

## Gotchas

- **`authClient.ts` silently falls back to localhost** if `EXPO_PUBLIC_SUPABASE_URL` (or `VITE_SUPABASE_URL`) is missing. Fine for dev, dangerous in prod.
- **Edge Functions use Deno, not Bun**: Use `Deno.env.get()`. Schema duplicated in `supabase/functions/_shared/schema.ts` — keep in sync with `packages/postgres/src/schema/`.
- **API URL routing**: Frontend `/api/*` paths mapped to Edge Function URLs by `src/lib/api-base.ts`. Dynamic segments become query params.
- **Supabase API key naming**: Uses `SUPABASE_KEY` / `SUPABASE_SECRET_KEY` (new format). Legacy fallbacks (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) retained for Edge Functions runtime.
- **Bun JSON column bug**: `Object.getPrototypeOf(value)` returns `null` in Bun for SQL driver values, breaking Drizzle JSON handling. Serialize/deserialize manually.
- **Vite envPrefix**: Both `VITE_*` and `EXPO_PUBLIC_*` prefixes are exposed to the client bundle (see `vite.config.ts`). The `EXPO_PUBLIC_*` names are kept for backwards compatibility with existing `.env` files.
- **`.env.remote`**: Vite does not load `.env.remote` natively. The `dev` script wraps Vite with `dotenvx` to inject those variables. Build/preview scripts use Vite's default `.env*` loading.
- **Ingestion logic duplication**: `_shared/sec-ingest.ts` mirrors column mappings from `directors-ingestion.ts` and `compensation-ingestion.ts`. Keep both in sync.
- **Edge Function timeouts**: 150s (free) / 400s (Pro). Long-running ops (summarization) should be run via the seed script or broken into smaller batches.
- **React Router 7**: Use `useParams<{ ticker: string }>()` and `useNavigate()` for routing primitives. The repo does not use the data-routing API (`createBrowserRouter` + loaders/actions); routes are configured declaratively in `src/App.tsx`.

## Version Verification

Check `package.json` versions before using library APIs. If the installed version is older than your training data, don't assume latest APIs exist. If newer, flag it and verify docs before committing to an approach.

## Stack-Specific Escalation Triggers

| Situation | Level |
|-----------|-------|
| Modifying Mantine theme tokens or `createTheme` config | Level 1 |
| Writing or modifying Supabase migrations | Level 1 |
| Bun-specific APIs (`Bun.serve`, `Bun.file`, `bun:sqlite`, etc.) | Level 1 |
| Claude API integration (RAG pipeline, embeddings, prompting) | Level 1 |
| Supabase Edge Function schema changes (keep `_shared/schema.ts` in sync with `packages/postgres/src/schema/`) | Level 1 |
| Supabase Realtime channel setup or subscriptions | Level 1 |
| Vite config changes (envPrefix, alias, plugins) | Level 1 |
| React Router 7 data-routing migration (currently declarative routes only) | Level 2 |
| Supabase API key env var names (must match: `SUPABASE_KEY`, `SUPABASE_SECRET_KEY`) | Level 2 |
| Supabase RLS policy creation or modification | Level 3 |
| Supabase Auth configuration changes | Level 3 |

## Current Status

Setup instructions in `README.md`. Tech debt tracked in `docs/TECH-DEBT.md`.

### What Works
- Web app routes: home, sign-in, sign-up, discover, company, executive, onboarding, profile, my-pay, my-company
- Core data pipeline: SEC ingestion → AI summarization → RAG Q&A
- Company dashboard: income sunburst, CEO spotlight, leadership, financials, MD&A, risk factors, 8-K events, insider trading
- Compensation fairness analysis (My Pay) and personalized "what this means for you" summaries
- Cross-app AskBar (RAG Q&A) on Discover and Company pages
- User onboarding flow (sign-up, profile, cost-of-living)
- Netlify-ready static SPA build (`bun run build` → `dist/`)

### In Progress / Remaining
- Job queue partially migrated to PostgreSQL `jobs` table (Edge Functions use DB queue; legacy server-side helpers still use in-memory)
- React component test coverage (currently zero)
- Sentry / error reporting in production build

### Reference Docs
- `docs/PROMPTS.md` — AI prompt templates, dispatch table, per-section vs. rollup grain, Edge-Function inline-prompt duplication
- `docs/MODULE-MAP.md` — Detailed module/directory descriptions
- `docs/FILING-SECTIONS.md` — SEC filing section codes and friendly names
- `docs/TECH-DEBT.md` — Known cleanup items
- `docs/adrs/` — Architecture decision records
- `SEED.md` — Seed script usage
