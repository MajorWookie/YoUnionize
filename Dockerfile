# ── Stage 1: Install dependencies ────────────────────────────────────────
FROM oven/bun:1.2 AS deps

WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY packages/ packages/
RUN bun install --frozen-lockfile

# ── Stage 2: Build the app ──────────────────────────────────────────────
FROM oven/bun:1.2 AS builder

WORKDIR /app
COPY --from=deps /app/node_modules node_modules/
COPY --from=deps /app/packages/ packages/
COPY . .
RUN bun run build

# ── Stage 3: Production image ───────────────────────────────────────────
FROM oven/bun:1.2-slim AS runner

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy built output and dependencies
COPY --from=builder /app/dist dist/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/packages packages/
COPY --from=builder /app/package.json .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "serve"]
