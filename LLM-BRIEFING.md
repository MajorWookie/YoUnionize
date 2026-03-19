# SEC API & Ingestion Pipeline — LLM Briefing

> Briefing for an LLM assistant working on the SEC data ingestion pipeline. Covers the API client, data fetching, transformation, and storage.

---

## Overview

We use **sec-api.io** as our SEC EDGAR data provider. Our client lives in `packages/sec-api/` and wraps their REST API with Valibot-validated responses. The ingestion pipeline is a 2-phase design: fetch raw data first, process it into domain tables second.

## sec-api.io API Endpoints We Use

All calls go through `SecApiClient` (`packages/sec-api/src/client.ts`). Auth is via API key in the `Authorization` header. Rate limits apply — the client retries 429s up to 3 times with exponential backoff (500ms → 1s → 2s).

### Filing Search (`POST /`)

Lucene query syntax over all SEC EDGAR filings. Returns filing metadata (accession number, form type, dates, links to documents).

```ts
client.searchFilings({
  query: 'ticker:AAPL AND formType:"10-K"',
  from: '0',    // pagination offset (string, max "10000")
  size: '10',   // results per page (string, max "50")
  sort: [{ filedAt: { order: 'desc' } }],
})
// Returns: { total: { value, relation }, filings: Filing[] }
```

We search for 4 filing types per company:
| Type | Query | Count |
|------|-------|-------|
| 10-K (annual report) | `formType:"10-K"` | 1 most recent |
| 10-Q (quarterly report) | `formType:"10-Q"` | 4 most recent |
| 8-K (current events) | `formType:"8-K"` + last 12 months | Up to 50 |
| DEF 14A (proxy statement) | `formType:"DEF 14A"` | 1 most recent |

### Section Extractor (`GET /extractor`)

Extracts a specific section from a filing by SEC item number. Returns plain text.

```ts
client.extractSection(filing.linkToFilingDetails, '7')  // Item 7 = MD&A
client.extractSection(filing.linkToFilingDetails, '1A') // Item 1A = Risk Factors
```

Section codes by filing type:

**10-K** (16 sections): `1` Business Overview, `1A` Risk Factors, `1B` Unresolved Staff Comments, `1C` Cybersecurity, `2` Properties, `3` Legal Proceedings, `4` Mine Safety, `5` Market Info, `6` Selected Financial, `7` MD&A, `7A` Quantitative Disclosures, `8` Financial Statements, `9` Disagreements w/ Accountants, `9A` Controls & Procedures, `9B` Other Info, `10` Directors & Governance, `11` Executive Compensation, `12` Security Ownership, `13` Related Transactions, `14` Accountant Fees, `15` Exhibits

**10-Q** (11 sections): `part1item1` Financial Statements, `part1item2` MD&A, `part1item3` Quantitative Disclosures, `part1item4` Controls & Procedures, `part2item1` Legal Proceedings, `part2item1a` Risk Factors, `part2item2` Unregistered Sales, `part2item3` Defaults, `part2item4` Mine Safety, `part2item5` Other Info, `part2item6` Exhibits

**8-K** (17 sections): `1-1` Entry Agreement, `1-2` Bankruptcy, `1-3` Mine Safety, `2-2` Results of Operations, `2-3` Creation of Obligation, `2-5` Exit Activities, `2-6` Material Impairments, `3-1` Delisting, `3-2` Unregistered Sales, `3-3` Material Modification, `4-1` Auditor Changes, `4-2` Financial Restatements, `5-2` Director/Officer Changes, `5-3` Amendments to Articles, `5-5` Code of Ethics, `6-1` ABS Info, `7-1` Reg FD Disclosure, `8-1` Other Events, `9-1` Financial Exhibits

### XBRL-to-JSON (`GET /xbrl-to-json`)

Converts XBRL financial data from a filing into structured JSON (income statement, balance sheet, cash flow, etc.). Only meaningful for 10-K and 10-Q filings.

```ts
client.xbrlToJson({ htmUrl: filing.linkToFilingDetails })
// Also supports: { accessionNo: '...' } or { xbrlUrl: '...' }
```

### Executive Compensation (`GET /compensation/:ticker`)

Returns all executive compensation records for a company across all available years. Data is extracted from DEF 14A proxy filings by sec-api.io.

```ts
client.getCompensationByTicker('AAPL')
// Returns: { data: ExecutiveCompensation[] }
```

Each record contains: `name`, `position`, `year`, `salary`, `bonus`, `stockAwards`, `optionAwards`, `nonEquityIncentiveCompensation`, `changeInPensionValueAndDeferredEarnings`, `otherCompensation`, `total`, `ceoPayRatio`. All dollar values are in whole dollars.

### Insider Trading (`POST /insider-trading`)

Form 3/4/5 transactions. Uses Lucene query syntax, same as filing search. Each transaction has a `nonDerivativeTable` and `derivativeTable`, each containing an array of individual transactions.

```ts
client.searchInsiderTrading({
  query: 'issuer.tradingSymbol:AAPL AND filedAt:[2025-03-19 TO *]',
  sort: [{ filedAt: { order: 'desc' } }],
})
// Returns: { total, transactions: InsiderTrade[] }
```

Transaction codes: `P` = purchase, `S` = sale, `A` = grant, `M` = exercise, `G` = gift.

We paginate through ALL transactions for the last 12 months using `client.paginateInsiderTrading()`.

### Directors & Board Members (`POST /directors-and-board-members`)

Returns proxy filings containing nested director arrays. **Important**: the `size` parameter controls the number of *proxy filings* returned, NOT the number of individual directors. Each filing has a `directors[]` array.

```ts
client.searchDirectors({
  query: 'ticker:AAPL',
  from: '0',
  size: '50',   // 50 proxy filings, each containing N directors
  sort: [{ filedAt: { order: 'desc' } }],
})
// Returns: { data: DirectorsFiling[] }
// Each DirectorsFiling has: { filedAt, accessionNo, directors: Director[] }
```

Each Director contains: `name`, `position`, `age`, `directorClass`, `dateFirstElected`, `isIndependent`, `committeeMemberships[]`, `qualificationsAndExperience[]`.

### Form 8-K Structured Data (`POST /form-8k`)

Pre-parsed 8-K events. Only 3 item types are structured by sec-api.io:

```ts
client.searchForm8K({
  query: 'ticker:AAPL',
  from: '0',
  size: '50',
  sort: [{ filedAt: { order: 'desc' } }],
})
// Returns: { data: Form8KFiling[] }
```

| Item | Field | What it contains |
|------|-------|-----------------|
| 4.01 | `items.item401` | Auditor changes: new/former accountant, going concern, ICFR weakness |
| 4.02 | `items.item402` | Financial restatements: reason, materiality, affected periods |
| 5.02 | `items.item502` | Personnel changes: name, position, change type, effective date |

### Company Mapping (`GET /mapping/ticker/:ticker`)

Resolves a ticker to company metadata: name, CIK, CUSIP, exchange, sector, industry, SIC code, etc. Also available by CIK, CUSIP, or name search.

## Ingestion Pipeline (2-Phase)

### Phase 1 — Fetch (`src/server/services/sec-fetcher.ts`)

Fetches all SEC API data for a company and stores **verbatim JSON responses** in the `raw_sec_responses` table. No transformation, no LLM calls.

```
fetchAllSecData(company) →
  ├── [parallel] searchFilings (10-K, 10-Q, 8-K, DEF 14A)
  ├── [parallel] getCompensationByTicker
  ├── [parallel] paginateInsiderTrading (last 12 months)
  ├── [parallel] searchDirectors
  ├── [parallel] searchForm8K
  │
  └── [sequential, per 10-K/10-Q/8-K filing]
       ├── xbrlToJson (10-K/10-Q only)
       └── extractSection (all available sections for that filing type)
```

Each response is upserted into `raw_sec_responses` with:
- `company_id` — FK to companies table
- `endpoint` — one of: `filings`, `compensation`, `insider_trading`, `directors`, `form_8k`, `xbrl`, `sections`
- `sub_key` — disambiguates within an endpoint (e.g., `10-K`, `{accessionNo}`, `{accessionNo}:{sectionCode}`)
- `raw_response` — the verbatim JSON from sec-api.io
- `fetch_status` — `complete` or `error`
- `process_status` — starts `pending`, set by Phase 2

### Phase 2 — Process (`src/server/services/raw-data-processor.ts`)

Reads all `pending` rows from `raw_sec_responses` for a company and transforms each into domain tables:

| Endpoint | Domain Table | Dedup Strategy |
|----------|-------------|----------------|
| `filings` | `filing_summaries` | By accession number |
| `compensation` | `executive_compensation` | By (company, exec name, fiscal year) |
| `insider_trading` | `insider_trades` | By (company, filer name, date, shares) |
| `directors` | `directors` | By (company, name) — most recent filing wins |
| `form_8k` | `form_8k_events` | By (accession number, item type) |
| `xbrl` | `filing_summaries.rawData.xbrlData` | Merged into parent filing record |
| `sections` | `filing_summaries.rawData.extractedSections` | Merged into parent filing record (keyed by section code) |

After all rows are processed, runs AI summarization: filings without an `aiSummary` → Claude → summary stored → 1536-dim embeddings generated for RAG.

### Lambda Handlers (`src/server/lambda/ingestion.ts`)

| Handler | Phase | Input |
|---------|-------|-------|
| `fetchHandler` | 1 | `{ ticker }` |
| `processHandler` | 2 | `{ ticker, skipSummarization? }` |
| `fetchBatchHandler` | 1 (batch) | `{ tickers[], parentJobId? }` |
| `handler` (legacy) | 1+2 interleaved | `{ ticker, skipSummarization? }` |

### Key Design Decisions

- **Why 2 phases?** Re-running LLM summarization shouldn't require re-fetching from sec-api.io (costs money, has rate limits). Raw responses are kept verbatim so future processing can extract data that current transformers ignore.
- **Why `raw_sec_responses`?** It's a data lake. Compensation and directors are per-company (not per-filing), so they don't fit in `filing_summaries.rawData`. A single table with `endpoint`+`sub_key` keys handles all response shapes.
- **Error isolation**: Each endpoint fetch is independent via `Promise.allSettled()`. A failing directors API call won't block filing ingestion.
- **Idempotency**: Phase 1 uses upsert on `(company_id, endpoint, sub_key)`. Phase 2 checks for existing records before inserting. Safe to re-run either phase.

## File Map

```
packages/sec-api/
  src/client.ts              # SecApiClient — all API calls
  src/sec-api.types.ts       # TypeScript interfaces for API responses
  src/sec-api.schemas.ts     # Valibot schemas for response validation
  src/sec-api.constants.ts   # Filing types, section codes, pagination limits
  src/sec-api.error.ts       # SecApiError class
  src/__tests__/             # Client tests

src/server/services/
  sec-fetcher.ts             # Phase 1: fetch + store raw responses
  raw-data-processor.ts      # Phase 2: transform raw → domain tables
  filing-ingestion.ts        # Legacy filing ingestion (used by old handler)
  compensation-ingestion.ts  # Legacy compensation ingestion
  insider-trading-ingestion.ts # Legacy insider trading ingestion
  directors-ingestion.ts     # Legacy directors ingestion
  summarization-pipeline.ts  # AI summarization (shared by both paths)
  company-lookup.ts          # Company search/upsert via mapping API

src/server/lambda/
  ingestion.ts               # Lambda handlers (fetch, process, batch, legacy)

src/database/schema/
  raw-sec-responses.ts       # raw_sec_responses table definition
  form-8k-events.ts          # form_8k_events table definition
  filing-summaries.ts        # filing_summaries table (implied, holds filings)
  executive-compensation.ts  # executive_compensation table
  insider-trades.ts          # insider_trades table
  directors.ts               # directors table
```
