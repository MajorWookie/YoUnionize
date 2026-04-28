# Younionize

Cross-platform application (iOS, Android, Web) for analyzing SEC filings with AI-powered summarization and compensation fairness insights. Younionize ingests SEC EDGAR data, generates AI summaries via Claude, and provides RAG-based Q&A — helping users understand executive compensation relative to their own.

## Features

- **SEC Filing Analysis** — Ingests 10-K, DEF 14A, and 8-K filings from SEC EDGAR with XBRL financial data extraction
- **AI Summarization** — Claude-powered summaries of filings, MD&A sections, risk factors, and company health assessments
- **RAG Q&A** — Ask natural language questions about any company's filings with vector-search-powered retrieval
- **Compensation Fairness** — Compare your compensation against executive pay with AI-generated fairness analysis
- **Company Dashboard** — Income sunburst charts, CEO spotlight, leadership profiles, financials, insider trading, and 8-K events
- **Personalized Insights** — "What this means for you" summaries tailored to your role and compensation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime / Package Manager | Bun 1.2 |
| Framework | Expo Router 6.x (file-based routing, React Native + Web) |
| UI | Tamagui 2.0 (cross-platform design system) |
| Database | PostgreSQL via Supabase + pgvector (1024-dim embeddings) |
| ORM | Drizzle ORM 0.40 |
| Auth | Supabase Auth (email/password) |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) |
| Embeddings | Voyage AI (voyage-4-lite dev / voyage-finance-2 prod) |
| SEC Data | sec-api.io |
| API Layer | Supabase Edge Functions (Deno, 18 endpoints) |
| Background Jobs | PostgreSQL job queue |
| Validation | Valibot 1.0 |
| Linting | oxlint + oxfmt |
| Testing | Vitest (unit), Playwright (E2E scaffold) |
| Hosting (Web) | Netlify ([younionize.me](https://younionize.me)) |
| Hosting (API) | Supabase Edge Functions |
| Charts | react-native-svg (custom PieChart, SunburstChart) |

## Prerequisites

- **[Bun](https://bun.sh) 1.2+** — runtime and package manager
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** — required for local Supabase
- **[Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)** — `brew install supabase/tap/supabase`
- **Xcode** — iOS development only (macOS)
- **Android Studio** — Android development only

### API Keys Required

| Service | Sign Up | Purpose |
|---------|---------|---------|
| [sec-api.io](https://sec-api.io) | API key | SEC EDGAR filing access |
| [Anthropic](https://console.anthropic.com) | API key | Claude AI summarization and RAG |
| [Voyage AI](https://www.voyageai.com) | API key | Embedding generation (optional — falls back to Ollama) |

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url> && cd Younionize
bun install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your API keys. See [Environment Variables Reference](#environment-variables-reference) for all options. The `.env.example` file has comments explaining each variable.

### 3. Start local Supabase

```bash
supabase start
```

This starts PostgreSQL, Auth, Studio, and the API gateway in Docker containers. Copy the outputted keys into your `.env` if they differ from the defaults.

### 4. Apply database migrations

```bash
bun run supabase:migrate   # runs: supabase db reset
```

This resets the local database and replays all migrations from `supabase/migrations/`.

### 5. Seed data (optional)

> **Cost Warning:** Seeding uses paid APIs that will incur charges. Review the estimates below before running.

| Scenario | sec-api.io | Claude (Haiku 4.5) | Voyage AI | Est. Total |
|----------|-----------|-------------------|-----------|------------|
| 1 company, 1 year, no AI | ~10 calls | — | — | ~$0 (free tier may cover) |
| 1 company, 1 year, with AI | ~10 calls | ~$0.30–0.60 | < $0.01 | ~$0.50–1.00 |
| 1 company, 5 years, with AI | ~50 calls | ~$1–2 | < $0.05 | ~$1–2 |
| 30 companies, 5 years, with AI | ~1,500 calls | ~$15–30 | ~$0.50 | ~$15–30 |

- **sec-api.io** — Free tier allows 100 API calls. Full 30-company seed requires a paid plan (~$49/month). A single company with `--years=1` may fit within the free tier.
- **Anthropic Claude** — Summarization uses Claude Haiku 4.5 ($0.80/M input tokens, $4/M output tokens). Cost scales with filing count and section length.
- **Voyage AI** — Embeddings are very inexpensive (~$0.02/M tokens). Optional — falls back to local Ollama if `VOYAGE_API_KEY` is unset.

**Recommendation:** Start with a single company and limited history to verify your setup before committing to a larger seed:

```bash
# Cheapest: single company, 1 year, data only (no AI costs)
bun run seed -- --tickers=AAPL --years=1 --skip-summarization

# Single company with AI summarization (~$0.50)
bun run seed -- --tickers=AAPL --years=1

# Full pipeline — SEC data + AI summaries (see cost table above)
bun run seed

# Data only, no AI summarization (faster, needs SEC_API_KEY only)
bun run seed:no-ai
```

See [SEED.md](SEED.md) for all options, default tickers, and troubleshooting.

### 6. Run the app

```bash
# Start Supabase + Expo dev server (mobile + web)
bun dev

# Web only
bun dev:web

# Edge Functions local dev (separate terminal)
bun run dev:functions

# iOS (requires Xcode)
bun run prebuild   # generates native projects (first time only)
bun run ios

# Android
bun run android
```

## Available Scripts

### Development

| Command | Description |
|---------|-------------|
| `bun dev` | Start Supabase + Expo dev server |
| `bun dev:web` | Start Supabase + Expo web server only |
| `bun run dev:functions` | Run Edge Functions locally |
| `bun run ios` | Start iOS dev build |
| `bun run android` | Start Android dev build |
| `bun run prebuild` | Generate native projects (iOS/Android) |

### Database

| Command | Description |
|---------|-------------|
| `bun run supabase:start` | Start local Supabase |
| `bun run supabase:stop` | Stop local Supabase |
| `bun run supabase:status` | Show Supabase container status |
| `bun run supabase:migrate` | Reset local DB + replay migrations |
| `bun run local_supabase:reset` | Reset local Supabase database |
| `bun run remote_supabase:reset` | Reset remote Supabase database |

### Seeding

| Command | Description |
|---------|-------------|
| `bun run seed` | Seed companies with SEC data + AI summaries |
| `bun run seed:no-ai` | Seed SEC data only (no AI) |
| `bun run local_supabase:seed` | Seed local database |
| `bun run remote_supabase:seed` | Seed remote database (uses `.env.remote`) |

### Code Quality

| Command | Description |
|---------|-------------|
| `bun run lint` | Run oxlint |
| `bun run lint:fix` | Fix lint issues + format with oxfmt |
| `bun run format` | Format code with oxfmt |
| `bun run typecheck` | TypeScript type checking |
| `bun run test` | Run Vitest in watch mode |
| `bun run test:unit` | Run unit tests once |
| `bun run test:e2e` | Run Playwright E2E tests |
| `bun run test:all` | Run all tests (unit + E2E) |
| `bun run check:all` | Lint + typecheck + unit tests |

### Deployment

| Command | Description |
|---------|-------------|
| `bun run build:web` | Build web app (Expo export) |
| `bun run deploy:functions` | Deploy Edge Functions to Supabase |

## Project Structure

```
Younionize/
├── app/                    # Expo Router file-based routes
│   ├── _layout.tsx         #   Root layout
│   ├── index.tsx           #   Home / Discover screen
│   ├── sign-in.tsx         #   Auth screens
│   ├── sign-up.tsx
│   └── (app)/              #   Authenticated route group
│       ├── company/[ticker]/  # Company detail dashboard
│       └── ask/               # RAG Q&A interface
├── src/
│   ├── database/           # Drizzle schema + Valibot validators
│   ├── features/           # Feature modules (auth, company, onboarding, ask)
│   ├── interface/          # Shared UI (charts, forms, layout, display)
│   ├── lib/                # Client-side utilities (API client)
│   ├── server/             # Server utilities + services
│   │   └── services/       #   Ingestion, summarization, enrichment
│   ├── tamagui/            # Theme config + tokens
│   └── test/               # Vitest setup + factories
├── packages/               # Workspace packages
│   ├── ai/                 #   @younionize/ai — Claude + Voyage + prompts
│   ├── helpers/            #   @younionize/helpers — ensureEnv, normalizeName
│   ├── hooks/              #   @younionize/hooks — useAuth, useDebounce
│   ├── postgres/           #   @younionize/postgres — Drizzle DB client
│   └── sec-api/            #   @younionize/sec-api — SEC API client
├── supabase/
│   ├── functions/          # 18 Edge Functions (Deno runtime)
│   │   ├── _shared/        #   Shared: db, auth, cors, schema
│   │   ├── ask/            #   RAG Q&A endpoint
│   │   ├── company-*/      #   Company data endpoints
│   │   ├── companies-*/    #   Search endpoints
│   │   └── user-*/         #   User profile endpoints
│   └── migrations/         # SQL migrations (timestamp-prefixed)
├── scripts/                # Utility scripts (seed-companies.ts)
├── docs/                   # Documentation + ADRs
├── e2e/                    # Playwright E2E test scaffold
├── ios/                    # iOS native project (Expo prebuild)
├── android/                # Android native project (Expo prebuild)
└── .github/workflows/      # CI + deployment workflows
```

## Edge Functions

Younionize's API layer runs on [Supabase Edge Functions](https://supabase.com/docs/guides/functions) (Deno runtime). There are 18 endpoints covering health checks, user management, company data, SEC ingestion, AI summarization, RAG Q&A, and compensation analysis.

```bash
# Run locally (requires local Supabase running)
bun run dev:functions

# Deploy to hosted Supabase
bun run deploy:functions
```

Local Edge Functions are available at `http://127.0.0.1:54321/functions/v1/{function-name}`.

**Note:** Edge Functions use Deno, not Bun. Environment variables use `Deno.env.get()`. Shared schemas in `supabase/functions/_shared/schema.ts` must stay in sync with `src/database/schema/`.

## Deployment

The web app is hosted on Netlify at [younionize.me](https://younionize.me); the API runs on Supabase Edge Functions; mobile builds go through EAS.

### Web (Netlify)

The Netlify project is `younionize` on the `betterhuman-applications` team. Netlify configuration lives in [netlify.toml](netlify.toml) — build command, publish directory (`dist/`), SPA `/*` rewrite to `/index.html`, and security headers.

**One-time setup steps** (do these once after the rename PR merges):

1. **Connect the GitHub repo to the Netlify project** in the [Netlify dashboard](https://app.netlify.com/projects/younionize) → Site configuration → Build & deploy → Link repository → select `MajorWookie/YoUnion`, branch `main`. Auto-deploy on push.
2. **Set production environment variables** (Site configuration → Environment variables). Only `EXPO_PUBLIC_*` vars are needed — server-only secrets stay in Supabase:
   - `EXPO_PUBLIC_SUPABASE_URL` — your hosted Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_KEY` — your hosted Supabase publishable key
3. **Attach the custom domain `younionize.me`** (Site configuration → Domain management → Add custom domain). Netlify will issue a Let's Encrypt cert automatically. Set `younionize.me` as the primary domain so `www.younionize.me` redirects to it.
4. **Add Supabase Auth redirect URLs** (Supabase dashboard → Authentication → URL Configuration → Redirect URLs):
   - `https://younionize.me/**`
   - `https://www.younionize.me/**`

Once these are set, every push to `main` deploys automatically. Manual deploys: `git push` or via the Netlify dashboard "Trigger deploy" button.

### Supabase Edge Functions

```bash
bun run deploy:functions
```

Deploys all functions in `supabase/functions/` to your linked Supabase project. CORS is locked to the Netlify production origins plus localhost via `supabase/functions/_shared/cors.ts`.

### EAS (Mobile Builds)

```bash
npx eas build              # Build iOS/Android binaries
npx eas submit             # Submit to App Store / Play Store
```

Build profiles (development, preview, production) are configured in `eas.json`.

### CI/CD

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | Pull requests to `main` | Lint, typecheck, unit tests |

## Testing

```bash
bun run test         # Vitest watch mode
bun run test:unit    # Unit tests (single run)
bun run test:e2e     # Playwright E2E (scaffolded, not active)
bun run check:all    # Lint + typecheck + unit tests
```

Test coverage includes: API utilities, XBRL parsing, compensation math, API client, auth, AI prompts, SEC API schemas, helpers, enrichment, and company formatting (~13 test suites).

## Local Ports Reference

| Service | URL |
|---------|-----|
| Supabase API | `http://127.0.0.1:54321` |
| PostgreSQL | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Supabase Studio | `http://127.0.0.1:54323` |
| Connection Pooler | `127.0.0.1:54329` |
| Edge Functions | `http://127.0.0.1:54321/functions/v1/{name}` |

## Environment Variables Reference

Copy `.env.example` to `.env` and fill in your values. For remote/production, create `.env.remote`.

### Required

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase API endpoint (`http://127.0.0.1:54321` for local) |
| `SUPABASE_KEY` | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Supabase service role secret key |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase URL exposed to Expo client |
| `EXPO_PUBLIC_SUPABASE_KEY` | Supabase publishable key exposed to Expo client |
| `DATABASE_URL` | PostgreSQL connection string |
| `SEC_API_KEY` | sec-api.io API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |

### Optional

| Variable | Description |
|----------|-------------|
| `VOYAGE_API_KEY` | Voyage AI embeddings key (falls back to Ollama if unset) |
| `VOYAGE_EMBEDDING_MODEL` | `voyage-4-lite` (dev, default) or `voyage-finance-2` (prod) |
| `OLLAMA_BASE_URL` | Local Ollama URL for embeddings fallback |
| `POSTMARK_API_KEY` | Email service (future feature) |

### Legacy / Fallback

These are retained for backwards compatibility but not required for new setups:

| Variable | Replaced by |
|----------|-------------|
| `SUPABASE_ANON_KEY` | `SUPABASE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `EXPO_PUBLIC_SUPABASE_KEY` |
| `VITE_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_KEY` | `EXPO_PUBLIC_SUPABASE_KEY` |

## Design

- [Figma — UI Screens & Components](https://www.figma.com/design/sOaLnijKNhnXQ9uq6sdcno/Younionize-%E2%80%94-UI-Screens---Components?m=auto&t=wcLayY2d4xtX48si-1)

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](CLAUDE.md) | AI behavioral instructions and project conventions |
| [SEED.md](SEED.md) | Seed script usage, options, and troubleshooting |
| [docs/MODULE-MAP.md](docs/MODULE-MAP.md) | Detailed module and directory descriptions |
| [docs/TECH-DEBT.md](docs/TECH-DEBT.md) | Known tech debt tracker |
| [docs/adrs/](docs/adrs/) | Architecture Decision Records (Tamagui, Valibot, Supabase Auth, etc.) |
| [PLAN-REMOTE-IOS-TESTING.md](PLAN-REMOTE-IOS-TESTING.md) | Remote iOS testing setup plan |

## License

Private — not open source.
