#!/usr/bin/env bash
# reset-remote.sh — Reset linked remote Supabase database, enable pgvector,
# apply migrations, set secrets, and deploy Edge Functions.
#
# Usage:
#   ./scripts/reset-remote.sh
#
# Prerequisites:
#   - supabase CLI installed and linked (`supabase link --project-ref <ref>`)
#   - .env file with SEC_API_KEY, ANTHROPIC_API_KEY, VOYAGE_API_KEY
#
# ⚠️  This DESTROYS all data in the linked remote database.

set -euo pipefail

# ── Colors ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Load .env ───────────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env"
if [[ -f "$ENV_FILE" ]]; then
  info "Loading environment from .env"
  set -a
  source "$ENV_FILE"
  set +a
else
  error ".env file not found at $ENV_FILE — copy .env.example and fill in your keys"
fi

# ── Validate required env vars ──────────────────────────
[[ -z "${SEC_API_KEY:-}" ]]       && error "SEC_API_KEY is not set in .env"
[[ -z "${ANTHROPIC_API_KEY:-}" ]] && error "ANTHROPIC_API_KEY is not set in .env"
[[ -z "${VOYAGE_API_KEY:-}" ]]    && error "VOYAGE_API_KEY is not set in .env"

# ── Confirm destructive action ──────────────────────────
warn "This will RESET the linked remote database and DELETE all data."
read -r -p "Are you sure? (y/N): " confirm
[[ "$confirm" != "y" && "$confirm" != "Y" ]] && { echo "Aborted."; exit 0; }

# ── Step 1: Reset the linked remote database ────────────
# This drops all tables and replays all migrations from supabase/migrations/.
# The initial migration (20260315) enables pgvector on the public schema.
info "Step 1/3: Resetting linked remote database and applying migrations..."
supabase db reset --linked

# ── Step 2: Set secrets ─────────────────────────────────
info "Step 2/3: Setting Edge Function secrets..."
supabase secrets set \
  SEC_API_KEY="$SEC_API_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  VOYAGE_API_KEY="$VOYAGE_API_KEY"

info "Secrets set successfully."

# ── Step 3: Deploy Edge Functions ───────────────────────
info "Step 3/3: Deploying Edge Functions..."
supabase functions deploy

info "All done! Remote database reset, secrets configured, and functions deployed."
