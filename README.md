# YoUnionize

Web application for analyzing SEC filings with AI-powered summarization and compensation fairness insights. YoUnionize ingests SEC EDGAR data, generates AI summaries via Claude, and provides RAG-based Q&A — helping users understand executive compensation relative to their own.

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
| Build Tool | Vite 7 |
| Framework | React 19 + React Router 7 |
| UI | Mantine 7 (`@mantine/core`, `@mantine/charts`, `@mantine/notifications`, `@mantine/form`, `@mantine/hooks`) |
| Database | PostgreSQL via Supabase + pgvector (1024-dim embeddings) |
| ORM | Drizzle ORM 0.40 |
| Auth | Supabase Auth (email/password) |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) |
| Embeddings | Voyage AI (voyage-4-lite dev / voyage-finance-2 prod) |
| SEC Data | sec-api.io |
| API Layer | Supabase Edge Functions (Deno, ~22 endpoints) |
| Background Jobs | PostgreSQL job queue |
| Validation | Valibot 1.0 |
| Linting | oxlint + oxfmt |
| Testing | Vitest (unit), Playwright (E2E scaffold) |
| Hosting | Netlify (static SPA) + Supabase (Edge Functions, DB, Auth) |
| Charts | Mantine charts + custom SVG (SunburstChart) for advanced layouts |

## Prerequisites

- **[Bun](https://bun.sh) 1.2+** — runtime and package manager
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** — required for local Supabase
- **[Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)** — `brew install supabase/tap/supabase`

### API Keys Required

| Service | Sign Up | Purpose |
|---------|---------|---------|
| [sec-api.io](https://sec-api.io) | API key | SEC EDGAR filing access |
| [Anthropic](https://console.anthropic.com) | API key | Claude AI summarization and RAG |
| [Voyage AI](https://www.voyageai.com) | API key | Embedding generation (optional — falls back to Ollama) |

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url> && cd YoUnionize
bun install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your API keys. See [Environment Variables Reference](#environment-variables-reference) for all options.

For a smoother dev loop against remote Supabase, optionally set `EXPO_PUBLIC_DEV_TEST_EMAIL` and `EXPO_PUBLIC_DEV_TEST_PASSWORD` in your local env. The web app will sign in with these credentials on mount so `/api/*` calls have a real Supabase JWT — the first run against a fresh Supabase project auto-provisions the user. Without these, you'll go through the normal `/sign-in` form.

### 3. Start local Supabase

```bash
supabase start
```

This starts PostgreSQL, Auth, Studio, and the API gateway in Docker containers. Copy the outputted keys into your `.env` if they differ from the defaults.

### 4. Apply database migrations

```bash
bun run supabase:migrate   # runs: supabase db reset
```

### 5. Seed data (optional)

> **Cost Warning:** Seeding uses paid APIs that will incur charges. Review the estimates below before running.

| Scenario | sec-api.io | Claude (Haiku 4.5) | Voyage AI | Est. Total |
|----------|-----------|-------------------|-----------|------------|
| 1 company, 1 year, no AI | ~10 calls | — | — | ~$0 (free tier may cover) |
| 1 company, 1 year, with AI | ~10 calls | ~$0.30–0.60 | < $0.01 | ~$0.50–1.00 |
| 1 company, 5 years, with AI | ~50 calls | ~$1–2 | < $0.05 | ~$1–2 |
| 30 companies, 5 years, with AI | ~1,500 calls | ~$15–30 | ~$0.50 | ~$15–30 |

Start small to verify your setup:

```bash
# Cheapest: single company, 1 year, data only (no AI costs)
bun run seed -- --tickers=AAPL --years=1 --skip-summarization

# Single company with AI summarization (~$0.50)
bun run seed -- --tickers=AAPL --years=1

# Full pipeline — SEC data + AI summaries
bun run seed
```

See [SEED.md](SEED.md) for all options, default tickers, and troubleshooting.

### 6. Run the app

```bash
# Vite dev server (loads .env.remote via dotenvx)
bun dev

# Edge Functions local dev (separate terminal)
bun run dev:functions
```

The web app is served at `http://localhost:5173`.

## Available Scripts

### Development

| Command | Description |
|---------|-------------|
| `bun dev` | Start the Vite dev server with `.env.remote` loaded via dotenvx |
| `bun run build` | TypeScript check + Vite production build into `dist/` |
| `bun run preview` | Serve the production build locally |
| `bun run dev:functions` | Run Edge Functions locally |

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
| `bun run lint` | Run oxlint across `src/`, `server/`, `packages/`, `scripts/` |
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
| `bun run build` | Build the web app for production |
| `bun run deploy:functions` | Deploy Edge Functions to Supabase |

## Project Structure

```
YoUnionize/
├── src/                      # Web app (React + Vite + Mantine)
│   ├── App.tsx               #   Root router
│   ├── main.tsx              #   Entry point
│   ├── theme.ts              #   Mantine theme + token palette
│   ├── components/           #   UI components (Layout, charts, sections)
│   ├── routes/               #   Page-level routes
│   │   ├── home.tsx
│   │   ├── sign-in.tsx / sign-up.tsx
│   │   ├── discover.tsx
│   │   ├── company.tsx
│   │   ├── executive.tsx
│   │   ├── onboarding.tsx
│   │   ├── profile.tsx
│   │   ├── my-pay.tsx
│   │   └── my-company.tsx
│   └── lib/                  #   Client utilities (format, env-shim, types)
├── server/                   # Server-side ingestion + summarization (Bun)
│   ├── api-utils.ts          #   Request/response helpers
│   ├── ai-client.ts          #   Anthropic + embedding clients
│   ├── sec-api-client.ts     #   sec-api.io wrapper
│   ├── job-queue-db.ts       #   PostgreSQL-backed job queue
│   ├── lambda/ingestion.ts   #   Lambda entry for background ingestion
│   └── services/             #   Per-domain ingestion + summarization
├── packages/                 # Workspace packages
│   ├── ai/                   #   @younionize/ai — Claude + Voyage + prompts
│   ├── api-client/           #   @younionize/api-client — fetchWithRetry
│   ├── helpers/              #   @younionize/helpers — utilities
│   ├── hooks/                #   @younionize/hooks — useAuth, useDebounce
│   ├── postgres/             #   @younionize/postgres — Drizzle DB + schema + validators
│   └── sec-api/              #   @younionize/sec-api — SEC API client
├── supabase/
│   ├── functions/            # Edge Functions (Deno runtime)
│   │   └── _shared/          #   Shared: db, auth, cors, schema
│   └── migrations/           # SQL migrations (timestamp-prefixed)
├── scripts/                  # Utility scripts (seed-companies.ts)
├── tests/                    # Test factories shared across server/ tests
├── docs/                     # Documentation + ADRs
├── e2e/                      # Playwright E2E test scaffold
├── public/                   # Static assets served by Vite
├── index.html                # Vite entry HTML
├── vite.config.ts            # Vite config (envPrefix, alias `~/*` → ./src/*)
├── vitest.config.ts          # Vitest config (excludes web build, .claude/)
├── vitest.setup.ts           # Vitest setup (env defaults)
└── .github/workflows/        # CI + deployment workflows
```

## Edge Functions

YoUnionize's API layer runs on [Supabase Edge Functions](https://supabase.com/docs/guides/functions) (Deno runtime). The endpoints cover health checks, user management, company data, SEC ingestion, AI summarization, RAG Q&A, and compensation analysis.

```bash
# Run locally (requires local Supabase running)
bun run dev:functions

# Deploy to hosted Supabase
bun run deploy:functions
```

Local Edge Functions are available at `http://127.0.0.1:54321/functions/v1/{function-name}`.

**Note:** Edge Functions use Deno, not Bun. Environment variables use `Deno.env.get()`. Shared schemas in `supabase/functions/_shared/schema.ts` must stay in sync with `packages/postgres/src/schema/`.

## Deployment

### Web app

The web app is a static Vite SPA. `netlify.toml` configures Netlify to run `bun install && bun run build` and publish the `dist/` directory. The `[[redirects]]` rule rewrites unknown paths to `/index.html` so React Router handles client-side routes.

### Supabase Edge Functions

```bash
bun run deploy:functions
```

Deploys all functions in `supabase/functions/` to your linked Supabase project.

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

Test coverage focuses on the server pipeline (XBRL transformation, compensation math, raw-data processor helpers, enrichment) and the workspace packages (api-client, sec-api, ai, helpers).

## Local Ports Reference

| Service | URL |
|---------|-----|
| Vite Dev Server | `http://localhost:5173` |
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
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase URL exposed to the web client (`VITE_SUPABASE_URL` also works) |
| `EXPO_PUBLIC_SUPABASE_KEY` | Publishable key exposed to the web client (`VITE_SUPABASE_KEY` also works) |
| `DATABASE_URL` | PostgreSQL connection string |
| `SEC_API_KEY` | sec-api.io API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |

> **Why both `EXPO_PUBLIC_*` and `VITE_*`?** The repo accepts either prefix — `vite.config.ts` declares both as build-time exposed prefixes. The `EXPO_PUBLIC_*` names are kept for backwards compatibility with existing `.env` files; new variables can use `VITE_*`.

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

## Design

- [Figma — UI Screens & Components](https://www.figma.com/design/sOaLnijKNhnXQ9uq6sdcno/YoUnionize-%E2%80%94-UI-Screens---Components?m=auto&t=wcLayY2d4xtX48si-1)

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](CLAUDE.md) | AI behavioral instructions and project conventions |
| [SEED.md](SEED.md) | Seed script usage, options, and troubleshooting |
| [docs/MODULE-MAP.md](docs/MODULE-MAP.md) | Detailed module and directory descriptions |
| [docs/TECH-DEBT.md](docs/TECH-DEBT.md) | Known tech debt tracker |
| [docs/adrs/](docs/adrs/) | Architecture Decision Records |

## License

Private — not open source.
