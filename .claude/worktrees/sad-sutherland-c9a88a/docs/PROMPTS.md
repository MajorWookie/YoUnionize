# AI Prompts Reference

All prompt templates live in `packages/ai/src/prompts/`, one file per prompt. They are consumed by `ClaudeClient` in `packages/ai/src/claude.ts`.

Each prompt file exports a `*SystemPrompt()` and `*UserPrompt()` function, plus a params interface.

## Prompt Map

| Prompt File | ClaudeClient Method | API Endpoint | What It Does |
|---|---|---|---|
| `section-summary.ts` | `summarizeSection()` | `POST /api/companies/[ticker]/summarize` | Summarizes individual filing sections (risk factors, financials, exec comp, etc.). Includes per-section guidance via `SECTION_GUIDANCE` map. |
| `company-summary.ts` | `generateCompanySummary()` | `POST /api/companies/[ticker]/summarize` | Produces overall company health assessment as structured JSON (headline, company_health, key_numbers, outlook). Built from aggregated section summaries. |
| `mda-summary.ts` | `summarizeMda()` | `POST /api/companies/[ticker]/summarize` | Translates the MD&A section into structured markdown (Big Picture, Revenue, Costs, Forward-Looking). Optionally compares to prior-year MD&A. |
| `filing-summary.ts` | `generateFilingSummary()` | `POST /api/companies/[ticker]/summarize` | Plain-language summary of an entire filing for non-finance readers. |
| `employee-impact.ts` | `generateEmployeeImpact()` | `POST /api/companies/[ticker]/summarize` | Scans filings for employment signals: job security, benefits, geographic footprint, visa dependency, union activity. |
| `what-this-means.ts` | `generateWhatThisMeans()` | `POST /api/company-personalize` | Personalized "what this means for you" based on user's job title, pay, and industry. Cached per user. |
| `compensation-analysis.ts` | `generateCompensationAnalysis()` | `POST /api/analysis/compensation-fairness` | Fairness analysis comparing user pay to executive compensation. Returns structured JSON (fairness score, pay ratios, talking points). |
| `rag-answer.ts` | `generateRagResponse()` | `POST /api/ask` | Answers user questions using retrieved vector search context from SEC filings. Note: the `/ask` Edge Function calls Voyage AI directly (not through ClaudeClient) for the embedding step. |

## Conventions

- **Reading level**: All prompts target 8th-grade reading level
- **Financial terms**: Defined inline in parentheses on first use
- **Output format**: `company-summary`, `employee-impact`, and `compensation-analysis` return structured JSON (parsed via `extractJson()` in `packages/ai/src/extract-json.ts`). Others return markdown.
- **Retry logic**: All ClaudeClient methods use exponential backoff (5 retries, handles 429/529)
- **Summary versioning**: `CURRENT_SUMMARY_VERSION = 2` in the summarization pipeline. `CompanySummaryCard` handles v1/v2 via `isV2Summary()`.

## Embeddings (Not a Prompt, but Related)

Embeddings are generated via Voyage AI, not Claude:

- **Dev model**: `voyage-4-lite`
- **Prod model**: `voyage-finance-2`
- **Dimensions**: 1024 (pgvector)
- **Important**: Use `input_type: 'document'` when storing, `input_type: 'query'` when searching
- `ClaudeClient.generateEmbedding()` wraps the Voyage API call
- The `/ask` Edge Function calls Voyage directly (Deno runtime, not ClaudeClient)
