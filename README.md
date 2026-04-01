# YoUnion

Cross-platform application (iOS-first, then Android, then Web) for analyzing SEC filings with AI-powered summarization and compensation fairness insights.

## Getting Started

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

### Key Ports (local Supabase)

- API: `http://127.0.0.1:54321`
- Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`

## Project Documentation

- `CLAUDE.md` — AI behavioral instructions and project conventions
- `SEED.md` — Seed script usage reference
- `docs/MODULE-MAP.md` — Detailed module/directory descriptions
- `docs/TECH-DEBT.md` — Known tech debt tracker
- `docs/adrs/` — Architecture Decision Records
- `PLAN-REMOTE-IOS-TESTING.md` — Remote iOS testing setup plan
