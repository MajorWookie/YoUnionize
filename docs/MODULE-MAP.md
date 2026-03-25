# Module Map

| Directory | Responsibility |
|-----------|---------------|
| `app/` | File-based routing (Expo Router). Pages and layouts. **Note:** Legacy `app/api/` routes from One Framework still exist and use the old in-memory job queue — these should be removed (see tech debt). |
| `app/api/` | **Legacy** — 14 One Framework `+api.ts` routes still present. Superseded by Edge Functions but not yet deleted. Still reference old in-memory job queue. |
| `supabase/functions/` | 18 Supabase Edge Functions (Deno) — health, user-me, user-profile, user-cost-of-living, companies-lookup, companies-search, companies-search-sec, company-detail, company-fetch, company-ingest (legacy — superseded by company-fetch + company-process), company-process, company-summarize, company-summary-status, company-personalize, compensation-fairness, ask, batch-fetch, job-status |
| `supabase/functions/_shared/` | Shared Edge Function utilities: db, auth, cors, schema, api-utils, sec-fetch (SEC API call helpers), sec-ingest (lightweight DB insert for directors/compensation) |
| `src/database/schema/` | Drizzle ORM table definitions (companies, filings, exec comp, directors, insider trades, personalized summaries, embeddings, jobs, raw-sec-responses, form-8k-events, compensation-analyses, users) |
| `src/database/validators/` | Valibot schemas for insert validation (insider-trades, companies) |
| `supabase/migrations/` | SQL migrations (applied via `supabase db reset`) |
| `src/features/auth/` | Supabase client creation (server + client) and `ensureAuth()` |
| `src/features/ask/` | RAG Q&A UI (AskBar component) |
| `src/features/company/` | Company detail types (`CompanySummaryResult`, `EmployeeImpactResult`, `FilingSummaryResult`), formatting utilities, section components (LeadershipSection, CeoSpotlightCard, CompanySummaryCard, TextSummaryCard, IncomeStatementSunburst, IncomeBreakdownChart, FinancialsSection, InsiderTradingSection, RiskFactorsCard, IngestionPrompt), and data extraction utilities |
| `src/features/company/lib/` | Data extraction utilities — `income-data-extractor.ts` (XBRL income statement parser -> sunburst chart data) |
| `src/features/onboarding/` | Constants for user profile (org levels, pay frequencies, CoL categories) |
| `src/interface/` | Shared UI component library, organized by subdirectory |
| `src/interface/charts/` | Chart components — `PieChart.tsx` (donut, SVG), `SunburstChart.tsx` (multi-ring concentric, SVG), `BarChart.tsx` (horizontal bars), `ComparisonBar.tsx` (side-by-side split bar), `WaterfallChart.tsx` (stacked income breakdown), `FairnessGauge.tsx` (score ring) |
| `src/interface/display/` | Display components — `Card`, `EmptyState`, `ErrorState`, `LoadingState`, `MarkdownContent` (cross-platform markdown renderer using Tamagui theme tokens), `Stat` |
| `src/interface/feedback/` | Error handling — `ErrorBoundary`, `ToastProvider` |
| `src/interface/form/` | Form inputs — `CurrencyInput`, `SelectField`, `TextField` |
| `src/interface/icons/` | `TabIcons.tsx` / `TabIcons.native.tsx` (platform-split Phosphor tab icons) |
| `src/interface/layout/` | Layout components — `ScreenContainer` (scroll wrapper), `CompanyHeader` |
| `src/interface/navigation/` | Tab bar components — `BottomTabBar` (web), `NativeTabBar` (mobile) |
| `src/server/` | Server-side utilities (api-utils, job-queue, job-queue-db, ai-client, sec-api-client) |
| `src/server/services/` | Business logic: ingestion pipelines (filing, compensation, directors, insider trading), XBRL transform, summarization, sec-fetcher (Phase 1 raw fetch), raw-data-processor (Phase 2 domain processing) |
| `src/server/services/enrichment/` | Compensation and director enrichment functions (post-fetch processing): `compensation-name-enrichment.ts` (canonical exec names), `director-role-enrichment.ts` (role normalization), `director-name-enrichment.ts` (canonical director names via nickname mapping) |
| `scripts/` | Utility scripts: `seed-companies.ts` (run via `bun run seed` / `bun run seed:no-ai`) |
| `src/lib/` | Client-side utilities (fetchWithRetry API client) |
| `src/tamagui/` | Tamagui config, themes, semantic tokens |
| `src/test/` | Vitest setup and test data factories |
| `packages/ai/` | Anthropic SDK wrapper, Voyage AI embeddings, `extractJson` utility (Claude response parsing), prompt templates (filing summary, comp analysis, RAG, company summary, employee impact, MD&A summary, what-this-means) |
| `packages/ai/src/prompts/` | Specialized prompt templates — `company-summary.ts` (structured health assessment), `employee-impact.ts` (job security/H-1B signals), `mda-summary.ts` (markdown MD&A breakdown), `what-this-means.ts` (personalized conversational overlay) |
| `packages/postgres/` | Database connection, vector search functions |
| `packages/sec-api/` | SEC API client with Valibot-validated responses |
| `packages/helpers/` | `ensureEnv()`, `normalizeName()`, `getCanonicalFirstName()` + `nickname-map.ts` (nickname→formal name mapping), shared TypeScript types, concurrency utilities (`concurrency.ts`) |
| `packages/hooks/` | `useAuth()` (Supabase), `useDebounce()` |
| `supabase/` | Local Supabase config + migrations |
| `e2e/` | Playwright E2E test scaffold |
