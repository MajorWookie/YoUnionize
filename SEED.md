# Seed Script Reference

Preloads SEC financial data (filings, exec comp, insider trades, directors) and optionally runs AI summarization + embedding generation.

```bash
bun run seed [-- options]
# or directly:
bun run scripts/seed-companies.ts [options]
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--tickers=AAPL,MSFT` | Comma-separated list of tickers to seed | All 28 default tickers |
| `--years=N` | Number of years of data (N 10-Ks, N DEF 14As, N×12 months of 8-Ks) | 5 |
| `--skip-summarization` | Skip Claude AI summarization and embedding generation | Summarization enabled |

> **Note:** When using `bun run seed`, pass flags after `--` so Bun forwards them to the script (e.g. `bun run seed -- --tickers=AAPL`). When calling the script directly, `--` is not needed.

## Examples

### Single company (full pipeline)

```bash
bun run seed -- --tickers=AAPL
```

### Single company, limited history

```bash
# 2 years: fetches 2 10-Ks, 2 DEF 14As, 24 months of 8-Ks
bun run seed -- --tickers=AAPL --years=2

# 1 year: fetches 1 10-K, 1 DEF 14A, 12 months of 8-Ks
bun run seed -- --tickers=AAPL --years=1
```

### Single company, data only (fastest)

```bash
bun run seed -- --tickers=AAPL --years=1 --skip-summarization
```

### Multiple specific companies

```bash
bun run seed -- --tickers=AAPL,MSFT,GOOGL
```

### Multiple companies with limited history

```bash
bun run seed -- --tickers=AAPL,MSFT,GOOGL --years=3
```

### All 28 default companies, reduced data

```bash
bun run seed -- --years=1
```

### All defaults (28 companies, 5 years, with summarization)

```bash
bun run seed
```

### Data ingestion only for all defaults (no AI)

```bash
bun run seed -- --skip-summarization
```

## What Gets Ingested Per Company

| Data | Source | Count per `--years=N` |
|------|--------|-----------------------|
| 10-K (annual reports) | SEC EDGAR | N filings |
| DEF 14A (proxy statements) | SEC EDGAR | N filings |
| 8-K (current events) | SEC EDGAR | All within N×12 months (up to 50) |
| Executive compensation | sec-api.io | All available (not affected by `--years`) |
| Insider trades | sec-api.io | All available (not affected by `--years`) |
| Directors/board members | sec-api.io | All available (not affected by `--years`) |

## What Summarization Does

When summarization is enabled (the default), each filing is processed through:

1. **XBRL extraction** — Structured financial data (income statement, balance sheet, cash flow) parsed from XBRL
2. **Section extraction** — Key sections pulled from 10-K (business overview, risk factors, MD&A, legal) and DEF 14A (exec comp, proxy)
3. **Claude AI summarization** — Each filing section summarized via Claude
4. **Embeddings** — Summary text embedded for RAG search (OpenAI or Ollama)

## Concurrency

- **2 companies** processed in parallel (hardcoded)
- Within each company, filing types (10-K, DEF 14A, 8-K) and data pipelines (filings, comp, trades, directors) are fetched in parallel
- Filings are inserted sequentially with idempotency checks (skips duplicates)

## Requirements

- Local Supabase running (`supabase start`)
- Migrations applied (`bun run supabase:migrate`)
- Environment variables in `.env`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Always | PostgreSQL connection string |
| `SEC_API_KEY` | Always | sec-api.io API key |
| `ANTHROPIC_API_KEY` | Unless `--skip-summarization` | Claude AI summarization |
| `OPENAI_API_KEY` | For OpenAI embeddings | Embedding generation (falls back to Ollama) |
| `OLLAMA_BASE_URL` | For Ollama embeddings | Local embedding generation (used if set, or as fallback) |

## Rate Limits

The script handles API rate limits with automatic retry + exponential backoff:

- **Claude API**: 30,000 input tokens/min (free tier). Processes 1 filing at a time with 2 concurrent section calls. Retries up to 5 times on 429 errors.
- **SEC API**: Has its own rate limits. Running 2 companies in parallel may trigger 429s during bulk seeding.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Rate limit errors (429) dominating output | Reduce to `--tickers=AAPL` for a single company, or use `--skip-summarization` |
| Partially summarized filings | Reset DB with `supabase db reset`, then re-run |
| Missing environment variable error | Check `.env` has all required keys listed above |
| Supabase connection error | Run `supabase start` first, ensure Docker is running |
| Script seems stuck | SEC API or Claude API may be slow — check network. XBRL extraction can take 10-30s per filing |

## Default Tickers (28)

```
NVDA  AAPL  GOOGL  MSFT  AMZN  META  TSLA  BRK-B  JPM  AVGO
WMT   UPS   TGT    HD    KR    FDX   CVS   LOW    SBUX
NFLX  NKE   KO     DIS
LAMR  ORCL  FFIV   SNX   CDW
```
