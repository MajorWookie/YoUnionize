# AI Prompts Reference

All prompt templates live in `packages/ai/src/prompts/`, one file per prompt. They are consumed by `ClaudeClient` in `packages/ai/src/claude.ts`.

Each prompt file exports a `*SystemPrompt()` and `*UserPrompt()` function, plus a params interface.

## Prompt Map

| Prompt File | ClaudeClient Method | API Endpoint | What It Does |
|---|---|---|---|
| `section-summary.ts` | `summarizeSection()` | `POST /api/companies/[ticker]/summarize` | Summarizes individual filing sections (risk factors, financials, exec comp, etc.). Includes per-section guidance via `SECTION_GUIDANCE` map. |
| `company-summary.ts` | `generateCompanySummary()` | `POST /api/companies/[ticker]/summarize` | Produces overall company health assessment as structured JSON (headline, company_health, key_numbers, red_flags, opportunities). Consumes the markdown-aggregated section summaries built by the pipeline (NOT raw filing JSON). |
| `mda-summary.ts` | `summarizeMda()` | `POST /api/companies/[ticker]/summarize` | Translates the MD&A section into structured markdown (Big Picture, Revenue, Costs, Forward-Looking). Optionally compares to prior-year MD&A. |
| `employee-impact.ts` | `generateEmployeeImpact()` | `POST /api/companies/[ticker]/summarize` | Outlook-only: job security, compensation, growth, watch_items. Consumes aggregated section summaries. Pairs with `workforce-signals.ts` to produce the merged `employee_impact` rollup the frontend reads. |
| `workforce-signals.ts` | `generateWorkforceSignals()` | `POST /api/companies/[ticker]/summarize` | Workforce geography (US revenue vs US headcount mismatch) and H-1B/visa dependency. Consumes RAW business_overview + risk_factors text — direct quotes and exact figures matter for these signals. Output is merged with `generateEmployeeImpact` into the `employee_impact` rollup. |
| `what-this-means.ts` | `generateWhatThisMeans()` | `POST /api/company-personalize` | Personalized "what this means for you" based on user's job title, pay, and industry. Cached per user. |
| `compensation-analysis.ts` | `generateCompensationAnalysis()` | `POST /api/analysis/compensation-fairness` | Fairness analysis comparing user pay to executive compensation. Returns structured JSON (fairness score, pay ratios, talking points). |
| `rag-answer.ts` | `generateRagResponse()` | `POST /api/ask` | Answers user questions using retrieved vector search context from SEC filings. Note: the `/ask` Edge Function calls Voyage AI directly (not through ClaudeClient) for the embedding step. |

## Conventions

- **Reading level**: All prompts target 8th-grade reading level
- **Financial terms**: Defined inline in parentheses on first use
- **Output format**: `company-summary`, `employee-impact`, `workforce-signals`, and `compensation-analysis` return structured JSON (parsed via `extractJson()` in `packages/ai/src/extract-json.ts`). Others return markdown.
- **Aggregated input**: `company-summary` and `employee-impact` consume a markdown-aggregated view of the filing's per-section AI summaries (built by `buildAggregatedContext` in `summarization-pipeline.ts`), not the raw filing JSON. This cuts input tokens by ~80–90% per rollup. `workforce-signals` is the exception — it consumes raw `business_overview` + `risk_factors` text because direct quotes and exact figures matter.
- **Employee-impact merge**: The summarisation pipeline calls `generateEmployeeImpact` (outlook fields) and `generateWorkforceSignals` (geography + visa fields) separately, then merges the two outputs into a single `EmployeeImpactResult` object stored on `filing_summaries.ai_summary.employee_impact` for frontend backwards compatibility.
- **Legacy v1 type**: `FilingSummaryResult` (in `packages/ai/src/types.ts`) is retained because some `filing_summaries.ai_summary` rows in the database were produced by the now-removed `filing-summary.ts` prompt. The frontend's `CompanySummaryCard` discriminates v1 vs. v2 via `isV2Summary()`. No new v1 data is generated.
- **Retry logic**: All ClaudeClient methods use exponential backoff (5 retries, handles 429/529)
- **Summary versioning**: `CURRENT_SUMMARY_VERSION = 3` in the summarization pipeline. The pipeline only re-summarises filings at `summary_version = 0`, so existing v2/v3 rows stay put — backfill is opt-in (reset to 0 per company on demand).

## Embeddings (Not a Prompt, but Related)

Embeddings are generated via Voyage AI, not Claude:

- **Dev model**: `voyage-4-lite`
- **Prod model**: `voyage-finance-2`
- **Dimensions**: 1024 (pgvector)
- **Important**: Use `input_type: 'document'` when storing, `input_type: 'query'` when searching
- `ClaudeClient.generateEmbedding()` wraps the Voyage API call
- The `/ask` Edge Function calls Voyage directly (Deno runtime, not ClaudeClient)
