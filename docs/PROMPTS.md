# AI Prompts Reference

Prompt templates live in [packages/ai/src/prompts/](../packages/ai/src/prompts/) — one file per prompt, each exporting a `*SystemPrompt()` function, a `*UserPrompt()` function, and a `*Params` interface. They are consumed by `ClaudeClient` in [packages/ai/src/claude.ts](../packages/ai/src/claude.ts).

## Two Prompt Surfaces

The codebase has **two parallel prompt-execution paths** because Edge Functions run on Deno and don't share the Bun workspace runtime:

| Path | Runtime | How prompts are sourced |
|---|---|---|
| Server-side summarization pipeline | Bun | `ClaudeClient` imports prompt files from `packages/ai/src/prompts/` |
| Edge Functions (`/api/ask`, `/api/company-personalize`, `/api/analysis/compensation-fairness`) | Deno | Each function instantiates `Anthropic` directly and inlines its system prompt as a string literal |

The `rag-answer.ts`, `what-this-means.ts`, and `compensation-analysis.ts` files exist in the package and are exported from [packages/ai/src/index.ts](../packages/ai/src/index.ts), but in production their content is **duplicated** as inline strings inside the corresponding Edge Functions:

- `RAG_SYSTEM_PROMPT` in [supabase/functions/ask/index.ts](../supabase/functions/ask/index.ts) (~line 32)
- inline `systemPrompt` in [supabase/functions/company-personalize/index.ts](../supabase/functions/company-personalize/index.ts) (~line 106)
- inline `system` literal in [supabase/functions/compensation-fairness/index.ts](../supabase/functions/compensation-fairness/index.ts) (~line 125 — note this version uses a 1–10 fairness scale, not the 1–100 scale in `compensation-analysis.ts`)

**Sync caveat:** edits to those three prompt files do *not* propagate to the running Edge Functions. Treat them as templates kept for parity / future migration; if you change one, update the inline copy too.

## Prompt File Map

| Prompt File | ClaudeClient Method | Output | Where Invoked |
|---|---|---|---|
| [section-summary.ts](../packages/ai/src/prompts/section-summary.ts) | `summarizeSection()` | plain text (≤150 words) | Per-section summarization in [summarization-pipeline.ts](../src/server/services/summarization-pipeline.ts). Backs every dispatch kind that doesn't have its own template — see "Dispatch" below. |
| [mda-summary.ts](../packages/ai/src/prompts/mda-summary.ts) | `summarizeMda()` | structured markdown (Big Picture / Revenue / Profitability / Cash / Outlook / Bottom Line for Workers) | MD&A sections only (`mda` dispatch kind). Optional prior-period MD&A passed for comparison. |
| [company-summary.ts](../packages/ai/src/prompts/company-summary.ts) | `generateCompanySummary()` | JSON (`CompanySummaryResult` — headline, company_health, key_numbers, red_flags, opportunities) | Filing-level rollup. 10-K and 10-Q only. Stored on `filing_summaries.ai_summary.executive_summary`. |
| [employee-impact.ts](../packages/ai/src/prompts/employee-impact.ts) | `generateEmployeeImpact()` | JSON (`EmployeeImpactResult` — outlook, job_security, compensation_signals, growth_opportunities, **workforce_geography**, **h1b_and_visa_dependency**, watch_items) | Filing-level rollup. 10-K and 10-Q only. Receives `riskFactors` + `mdaText` extracted from per-section context. |
| [filing-summary.ts](../packages/ai/src/prompts/filing-summary.ts) | `generateFilingSummary()` | JSON (`FilingSummaryResult` — executive_summary, key_numbers, plain_language_explanation, red_flags, opportunities, employee_relevance) | **Currently unused in the production pipeline** (the rollup path uses `generateCompanySummary()` instead). Retained for ad-hoc invocation and tests. |
| [rag-answer.ts](../packages/ai/src/prompts/rag-answer.ts) | `ragQuery()` | plain text | `ClaudeClient.ragQuery()` is exported but the live `/api/ask` Edge Function uses an inline prompt — see "Two Prompt Surfaces" above. |
| [what-this-means.ts](../packages/ai/src/prompts/what-this-means.ts) | `generateWhatThisMeans()` | plain text (1–3 paragraphs, conversational) | Production `/api/company-personalize` uses an inline copy — the package method is unused at runtime. |
| [compensation-analysis.ts](../packages/ai/src/prompts/compensation-analysis.ts) | `generateCompensationAnalysis()` | JSON (`CompensationAnalysisResult` — fairness_score 1–100, explanation, comparisons, recommendations) | Production `/api/analysis/compensation-fairness` uses an inline copy with a 1–10 scale — the package method is unused at runtime. |

## Dispatch: How Sections Map to Prompts

[packages/sec-api/src/section-prompts.ts](../packages/sec-api/src/section-prompts.ts) owns the mapping from `(filingType, sectionCode)` → `SectionPromptKind`. The summarization pipeline iterates each `filing_sections` row, looks up the dispatch entry, and either skips (for `pass_through` items, short text, or empty fetches) or routes to a Claude call.

### Section prompt kinds (18 total)

| Kind | Backed by | Notes |
|---|---|---|
| `mda` | `summarizeMda()` → mda-summary.ts | Only specialised template for per-section content. |
| `risk_factors`, `business_overview`, `legal_proceedings`, `executive_compensation`, `financial_footnotes`, `cybersecurity`, `controls_and_procedures`, `related_transactions`, `proxy`, `narrative` | `summarizeSection()` → section-summary.ts | All share the same template. The dispatch kind is translated to the camelCase `sectionType` key via `PROMPT_KIND_TO_PROMPT_LABEL` (see [summarization-pipeline.ts:434](../src/server/services/summarization-pipeline.ts#L434)), which selects the `SECTION_GUIDANCE` block. Kinds without a matching guidance block fall back to the generic instruction. |
| `event_8k` | `summarizeSection()` with `sectionType: 'event_summary'` | Used for every 8-K item. The pipeline aggregates per-item summaries into a single markdown rollup at `filing_summaries.ai_summary.event_summary`. |
| `pass_through` | none | Stores raw text only — no Claude call. Used for boilerplate items (Mine Safety, deprecated Selected Financial Data, Item 11 in 10-K which is incorporated-by-reference, signatures, exhibit indexes). |
| `rollup_executive_summary`, `rollup_employee_impact` | `generateCompanySummary()` / `generateEmployeeImpact()` | Filing-level rollups, not per-section. Live on `filing_summaries`. |
| `xbrl_income_statement`, `xbrl_balance_sheet`, `xbrl_cash_flow`, `xbrl_shareholders_equity` | `transformXbrlToStatements()` | Pure structured transformation — no Claude call. |

### Per-section vs. rollup grain

After [migration 20260429000000_per_section_summaries.sql](../supabase/migrations/), per-item summaries live on `filing_sections.ai_summary` (one row per SEC item), while filing-level synthesis lives on `filing_summaries.ai_summary`:

```
filing_sections.ai_summary           ← per-item, one row per (filing, sectionCode)
filing_summaries.ai_summary
    ├── executive_summary            ← rollup_executive_summary
    ├── employee_impact              ← rollup_employee_impact
    ├── income_statement / …         ← xbrl_* transforms
    ├── event_summary                ← aggregated 8-K item markdown
    └── executive_compensation       ← DEF 14A only: top-5 + analysis
```

The DEF 14A `executive_compensation` rollup is built by `buildExecCompRollup()` in the pipeline — it pulls the top 5 executives by total comp from the `executive_compensation` table and calls `summarizeSection()` (with `sectionType: 'executiveCompensation'`) on the proxy text, *not* `generateCompensationAnalysis()`.

## Prompt Versioning

`PROMPT_VERSIONS` in [section-prompts.ts](../packages/sec-api/src/section-prompts.ts) maps each kind to a version string (e.g. `risk_factors@v1`, `rollup_executive_summary@v2`). Each `filing_sections` row stores the version it was summarized under in `prompt_id`.

**Bump the version suffix when editing a prompt template's wording.** The next pipeline run will re-summarize only the rows whose `prompt_id` no longer matches the current version, scoped by the partial index `filing_sections_pending_summarize_idx` (`summary_version IN (0, -1)` — 0 = unprocessed, -1 = last attempt failed).

`CURRENT_SUMMARY_VERSION = 2` in [packages/ai/src/types.ts](../packages/ai/src/types.ts) is a separate, coarser-grained marker that tracks the schema/shape of summaries (used by `CompanySummaryCard` to choose v1 vs. v2 rendering).

## Conventions

- **Reading level**: 8th grade, financial terms defined inline in parentheses on first use.
- **Output format discipline**: prompts that return JSON say so explicitly and end with "Respond with ONLY the JSON object, no markdown code fences or other text." JSON is parsed via [`extractJson()`](../packages/ai/src/extract-json.ts), which strips markdown fences and prose wrappers. Markdown and plain-text prompts say so explicitly too — be deliberate about which you're writing.
- **No investment advice** — every prompt explicitly forbids it.
- **Tone**: supportive and empowering for compensation analysis; direct and honest about red flags everywhere else.

## ClaudeClient Internals

- **Default model**: `claude-haiku-4-5` (overridable via `ClaudeClientConfig.model`). Edge Functions hard-code the same model.
- **Default `max_tokens`**: 4096. `summarizeSection()` and `whatThisMeans()` use 2048; `summarizeMda()` uses 3072.
- **Retries**: 5 attempts with exponential backoff + ±25% jitter. Honors the `retry-after` header on 429s; otherwise `2000 * 2^attempt` ms. Triggers on HTTP 429 and 529.
- **Logging**: every call logs `[ClaudeClient] {model} — {in} in / {out} out` via `console.info`.

## Embeddings (Voyage AI)

Embeddings are not Claude calls but live on the same client.

- **Dev model**: `voyage-4-lite`
- **Prod model**: `voyage-finance-2`
- **Dimensions**: 1024 (matches the `pgvector` column width)
- **`input_type`**: pass `'document'` when storing, `'query'` when searching — required for symmetric retrieval quality.
- `ClaudeClient.generateEmbedding()` wraps the Voyage REST API.
- The `/ask` Edge Function calls Voyage directly (Deno runtime) — same 1024-dim contract, but it does not go through `ClaudeClient`.
