# CLAUDE.md — Younionize

## Project Overview

Younionize is a cross-platform application (iOS-first, then Android, then Web) for analyzing SEC filings with AI-powered summarization and compensation fairness insights. It ingests SEC EDGAR data, generates AI summaries via Claude, and provides RAG-based Q&A — helping users understand executive compensation relative to their own.

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
- **API Layer**: Supabase Edge Functions (Deno runtime, 18 endpoints)
- **Background Jobs**: PostgreSQL-backed job queue
- **Validation**: Valibot 1.0 (NOT Zod)
- **Linting**: oxlint + oxfmt (NOT ESLint/Prettier)
- **Testing**: Vitest (unit), Playwright (E2E — scaffolded, not active)
- **Deployment**: Supabase Edge Functions
- **Charts**: react-native-svg (custom SVG-based PieChart, SunburstChart); React Native `View` for inline bar fills
- **Markdown**: react-native-markdown-display 7.x
- **Icons**: Phosphor (phosphor-react for web, phosphor-react-native for mobile)

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
│  18 API endpoints: health, user, companies, ask, etc.    │
│  _shared/: db, auth, cors, schema, api-utils,            │
│            sec-fetch, sec-ingest                          │
├─────────────────────────────────────────────────────────┤
│                   packages/ (workspace)                   │
│  @younionize/ai       — Claude API wrapper + prompts + extractJson │
│  @younionize/postgres  — Drizzle DB client (postgres-js)       │
│  @younionize/sec-api   — SEC EDGAR API client + schemas        │
│  @younionize/helpers   — Shared utilities (ensureEnv, types,   │
│                     concurrency, normalizeName, nicknames)│
│  @younionize/hooks     — React hooks (useAuth, useDebounce)    │
└─────────────────────────────────────────────────────────┘
         │                    │                  │
    Supabase Auth      PostgreSQL + pgvector    SEC API
    (managed)          (Drizzle ORM)            (sec-api.io)
```

See `docs/MODULE-MAP.md` for detailed module/directory descriptions.

### Data Flow

1. **User searches** → Discover fires TWO parallel calls: `GET /api/companies/search` (local DB) and, if local results < 3, `GET /api/companies/search-sec` (SEC API + upsert). Local results display immediately; SEC results appended async.
2. **Company detail** → `GET /api/companies/{ticker}/detail` → auto-fetches directors/execs from SEC if missing. Dashboard: income sunburst, CEO spotlight, leadership, financials, MD&A, risk factors, 8-K events.
3. **Phase 1 — SEC fetch** → `POST /api/companies/[ticker]/fetch` → stores verbatim JSON in `raw_sec_responses`
4. **Phase 2 — Processing** → `POST /api/companies/[ticker]/process` → transforms raw data into domain tables with enrichment
5. **Summarization** → `POST /api/companies/[ticker]/summarize` → routes sections to specialized prompts → stores summaries + 1024-dim Voyage AI embeddings
6. **RAG Q&A** → `POST /api/ask` → Voyage AI embed (`input_type: 'query'`) → vector search (cosine ≥ 0.3) → optional reranking → Claude generates answer
7. **Compensation analysis** → `POST /api/analysis/compensation-fairness` → user profile + exec comp → Claude fairness analysis
8. **Personalized summary** → `POST /api/company-personalize` → cached per-user "what this means for you" via Claude Haiku

## Conventions

### Naming
- **Files**: kebab-case for utilities (`api-client.ts`), PascalCase for components (`ScreenContainer.tsx`), dot-separated for domain files (`sec-api.schemas.ts`)
- **Functions**: camelCase, verb-first (`ingestFilings`, `summarizeSection`, `transformXbrl`)
- **Types/Interfaces**: PascalCase, no prefix (`CompanyRecord`, `FilingSummary`)
- **Database tables**: snake_case, plural (`filing_summaries`, `insider_trades`)
- **Constants**: UPPER_SNAKE_CASE for env vars, camelCase arrays/objects (`orgLevels`, `payFrequencies`)

### Patterns
- **Git branching**: Always create a new branch before starting work. Never commit directly to `main`. Branch naming: `fix/<description>` or `feat/<description>`.
- **Dependency versions**: Fix mismatches directly in `package.json` — never use `overrides` or `resolutions`. Expo SDK versions must stay aligned with `bundledNativeModules.json`.
- **Validation**: Valibot schemas in `src/database/validators/`. Every POST/PUT body validated before processing.
- **API routes**: `withLogging()` wrapper + `classifyError()` for standardized errors. Protected routes use `ensureAuth()`.
- **Error handling**: Try-catch at API boundary, `Promise.allSettled()` for parallel ops, errors accumulated not thrown in services.
- **Exports**: Named exports only. Index files are re-export barrels — no logic.
- **Logging**: `console.info()` only (never `console.log()`).
- **Type safety**: No `any` — use `unknown` with type guards. Explicit return types on exported functions.

### Visualization & Display
- **SVG charts** (`PieChart`, `SunburstChart`): built with `react-native-svg`. Minimum arc width 7.2°.
- **Bar fill charts** (`BarChart`, `ComparisonBar`, `WaterfallChart`, `FairnessGauge`): use React Native `View` (as `RNView`) with inline `style`. Do NOT use Tamagui `View` for percentage-width fills — it breaks on native.
- **`ScreenContainer` scroll**: Uses RN's `ScrollView` (NOT Tamagui's). Inner `YStack` uses `style={{ flexGrow: 1 }}` (not `flex={1}`). **Critical:** `flex: 1` includes `flexBasis: 0` which caps height and breaks scrolling.
- **Markdown**: `MarkdownContent` wraps `react-native-markdown-display` with Tamagui theme tokens. Enable via `markdown` prop on `TextSummaryCard`.

### Name Normalization & Deduplication
- **`normalizeName()`** in `@younionize/helpers` — lowercase, trim, strip honorific suffixes. Used for people dedup across filings.
- **`getCanonicalFirstName()`** in `@younionize/helpers` — maps nicknames to formal names (e.g., "Bill" → "William") via static `nickname-map.ts`. Used in enrichment layer only (not in `normalizeName()`) to avoid false positives in dedup indexes.
- **Dedup indexes**: `directors_dedup_idx` (company_id, normalized_name) and `exec_comp_dedup_idx` (company_id, normalized_name, fiscal_year).
- **Sync requirement**: The SQL migration and `normalizeName()` helper use the same regex — keep them in sync.

### Styling (Tamagui)
- Use `styled()` for variants. Use design tokens — never hardcode colors/spacing/fonts.
- **Use shorthand props**: `mb`, `mt`, `mx`, `my`, `pb`, `pt`, `px`, `py`, `bg`, `rounded`, `items`, `justify`, `self`, `z`, `minW`, `minH`, `text`. Do not revert to longform.
- Responsive layouts: Tamagui media queries, not platform checks. Platform-specific behavior: `.native.tsx` / `.web.tsx` file extensions.

### Database (Drizzle)
- Schema files: one per domain in `src/database/schema/`. Use `snake_case` for table/column names.
- Explicit types for all columns. Relations in `src/database/relations.ts`.
- Migrations: plain SQL in `supabase/migrations/` (timestamp-prefixed). Apply with `supabase db reset`.

### AI/API Patterns
- Claude API calls centralized in `packages/ai/` — don't scatter across components.
- **Prompt templates** in `packages/ai/src/prompts/` — one file per prompt, 8th-grade reading level, define financial terms.
- **Summary versioning**: `CURRENT_SUMMARY_VERSION = 2`. `CompanySummaryCard` handles v1/v2 via `isV2Summary()`.
- **ClaudeClient methods**: `summarizeSection()`, `generateCompanySummary()`, `generateEmployeeImpact()`, `summarizeMda()`, `generateWhatThisMeans()`, `analyzeCompensation()`, `generateRagResponse()`. All use exponential backoff (5 retries, handles 429/529).
- **`extractJson()`** in `@younionize/ai` — parses JSON from Claude responses, handling markdown fences and prose wrapping. Used by structured prompt responses (company-summary, employee-impact).
- Embeddings: always pass `input_type: 'document'` when storing, `input_type: 'query'` when searching.
- The `/ask` Edge Function calls Voyage AI directly (not `ClaudeClient`) because Edge Functions run on Deno.
- RAG pipeline components (embedding, retrieval, generation) must be clearly separated.

### File Organization
- One concept per file. Tests co-located (`.test.ts` or `__tests__/`). Types co-located with implementation.
- Server-only: `src/server/` and `src/features/*/server/`. Client-only: `src/features/*/client/` and `src/lib/`.

## Architecture Decisions

Documented in `docs/adrs/`. Key active decisions: Tamagui (not web-only UI libs), Valibot (not Zod), Supabase Auth, Expo Router, Edge Functions for API, Supabase migrations only (no drizzle-kit), 2-phase SEC fetch/process pipeline.

## Testing

- **Unit tests**: Vitest — `bun test` or `bun run test:unit`
- **Test setup**: `src/test/setup.ts` (env defaults), `src/test/factories.ts` (data factories)
- **Coverage**: ~13 test suites (api-utils, xbrl, compensation-math, api-client, auth, AI prompts, sec-api, helpers, enrichment, company format)
- **Not tested**: Ingestion services, summarization pipeline, DB operations, React components
- **CI**: Lint → type-check → unit tests on every PR (`.github/workflows/ci.yml`)

## Gotchas

- **`authClient.ts` silently falls back to localhost** if `EXPO_PUBLIC_SUPABASE_URL` is missing. Fine for dev, dangerous in prod.
- **Edge Functions use Deno, not Bun**: Use `Deno.env.get()`. Schema duplicated in `supabase/functions/_shared/schema.ts` — keep in sync with `src/database/schema/`.
- **API URL routing**: Frontend `/api/*` paths mapped to Edge Function URLs by `src/lib/api-base.ts`. Dynamic segments become query params.
- **Supabase API key naming**: Uses `SUPABASE_KEY` / `SUPABASE_SECRET_KEY` (new format). Legacy fallbacks (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) retained for Edge Functions runtime.
- **Bun JSON column bug**: `Object.getPrototypeOf(value)` returns `null` in Bun for SQL driver values, breaking Drizzle JSON handling. Serialize/deserialize manually.
- **Tamagui `flexGrow`**: Not a shorthand prop. Use `style={{ flexGrow: 1 }}` escape hatch. Similarly, use RN's `ScrollView` instead of Tamagui's for `contentContainerStyle`.
- **Tamagui TS2322 type errors**: Use `color as any` for dynamic color strings. Cast responsive components to `any` when shorthands inside `$gtMd` fail. Add explaining comments.
- **Ingestion logic duplication**: `_shared/sec-ingest.ts` mirrors column mappings from `directors-ingestion.ts` and `compensation-ingestion.ts`. Keep both in sync.
- **Edge Function timeouts**: 150s (free) / 400s (Pro). Long-running ops (summarization) should be run via the seed script or broken into smaller batches.
- **Expo Router**: Uses `useLocalSearchParams<T>()` (not `useParams`). Entry point must be `"main": "expo-router/entry"` in `package.json`.

## Version Verification

Check `package.json` versions before using library APIs. If the installed version is older than your training data, don't assume latest APIs exist. If newer, flag it and verify docs before committing to an approach.

## Stack-Specific Escalation Triggers

| Situation | Level |
|-----------|-------|
| Modifying `tamagui.config.ts` or Tamagui compiler settings | Level 1 |
| Writing or modifying Supabase migrations | Level 1 |
| Bun-specific APIs (`Bun.serve`, `Bun.file`, `bun:sqlite`, etc.) | Level 1 |
| Claude API integration (RAG pipeline, embeddings, prompting) | Level 1 |
| Cross-platform divergence (web vs. native behavior) | Level 1 |
| Supabase Edge Function schema changes (keep _shared/schema.ts in sync) | Level 1 |
| Supabase Realtime channel setup or subscriptions | Level 1 |
| Supabase API key env var names (must match: `SUPABASE_KEY`, `SUPABASE_SECRET_KEY`) | Level 2 |
| Supabase RLS policy creation or modification | Level 3 |
| Supabase Auth configuration changes | Level 3 |
| Native build issues (iOS/Android) | Level 2 |

## Current Status

Setup instructions in `README.md`. Tech debt tracked in `docs/TECH-DEBT.md`.

### What Works
- Core data pipeline: SEC ingestion → AI summarization → RAG Q&A
- Company dashboard: income sunburst (with OpEx breakdown), CEO spotlight, leadership (with fiscal year selector), financials, MD&A, risk factors, 8-K events, insider trading
- Leadership dedup with canonical names (nickname mapping) and fiscal year selection
- Compensation fairness analysis and personalized summaries
- User onboarding flow (sign-up, profile, cost-of-living)
- iOS native project prebuilt (`bun run prebuild`) — ready for simulator/device builds

### In Progress / Remaining
- Job queue partially migrated to PostgreSQL `jobs` table (Edge Functions use DB queue; legacy routes still use in-memory)
- No production deployment yet — local dev and staging only

### Reference Docs
- `SEED.md` — Seed script usage
- `PLAN-REMOTE-IOS-TESTING.md` — Remote iOS testing setup plan
