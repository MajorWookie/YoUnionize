# AI Prompts — Where to Edit Them

This is your hand-edit reference for every AI prompt in YoUnion. If you want to change how the AI summarizes filings, scores fairness, answers questions, or explains things to users, you change the files listed here.

---

## TL;DR — Where everything lives

All prompts are TypeScript files that export two functions each:
- **`*SystemPrompt()`** — the AI's persona, rules, and output format. **This is what you usually want to edit.**
- **`*UserPrompt(params)`** — the template that wraps the actual filing data. Edit this if you want to change *what data* the model sees, not how it behaves.

Primary location: [packages/ai/src/prompts/](../../packages/ai/src/prompts/)

The single file that wires every prompt up to the Claude API: [packages/ai/src/claude.ts](../../packages/ai/src/claude.ts) — change the `DEFAULT_MODEL` constant here (line 42) to swap which Claude model runs all prompts.

---

## Quick Reference Table

| What it does | File | Triggered by |
|---|---|---|
| Structured "company health" card (headline, key numbers, red flags, opportunities) | [company-summary.ts](../../packages/ai/src/prompts/company-summary.ts) | `POST /api/companies/[ticker]/summarize` |
| Worker-impact analysis (job security, H-1B, geography mismatch) | [employee-impact.ts](../../packages/ai/src/prompts/employee-impact.ts) | `POST /api/companies/[ticker]/summarize` |
| Generic filing summary (used when a structured summary isn't needed) | [filing-summary.ts](../../packages/ai/src/prompts/filing-summary.ts) | Internal `generateFilingSummary()` |
| Per-section summaries (risk factors, MD&A, business overview, etc.) | [section-summary.ts](../../packages/ai/src/prompts/section-summary.ts) | `POST /api/companies/[ticker]/summarize` |
| MD&A markdown breakdown (rendered as the MD&A card) | [mda-summary.ts](../../packages/ai/src/prompts/mda-summary.ts) | `POST /api/companies/[ticker]/summarize` |
| Pay fairness analysis (1–100 score, comparisons, recommendations) | [compensation-analysis.ts](../../packages/ai/src/prompts/compensation-analysis.ts) | `POST /api/analysis/compensation-fairness` |
| Personalized "What this means for you" overlay | [what-this-means.ts](../../packages/ai/src/prompts/what-this-means.ts) | `POST /api/company-personalize` |
| RAG Q&A answers (the chat/ask feature) | [rag-answer.ts](../../packages/ai/src/prompts/rag-answer.ts) **AND** [supabase/functions/ask/index.ts:32](../../supabase/functions/ask/index.ts#L32) | `POST /api/ask` |

---

## Prompt-by-Prompt Detail

### 1. Company Summary — [company-summary.ts](../../packages/ai/src/prompts/company-summary.ts)

**What it produces:** the structured "Company Health" card on the company dashboard. Returns JSON with these fields: `headline`, `company_health`, `key_numbers[]`, `red_flags[]`, `opportunities[]`.

**When to edit:**
- Change the *tone* of the headline (currently: "bold sentence capturing trajectory")
- Add/remove fields from `key_numbers` (currently asks for 4–6 metrics including revenue, profit, tax, headcount)
- Tighten or loosen what counts as a "red flag" vs. "opportunity"
- Adjust the reading level (currently 8th-grade)

**Input data:** the entire filing JSON (XBRL financials, etc.), truncated to ~100k chars by `truncateForContext()` in `claude.ts:371`.

---

### 2. Employee Impact — [employee-impact.ts](../../packages/ai/src/prompts/employee-impact.ts)

**What it produces:** the longest and most opinionated prompt. Returns JSON with `overall_outlook`, `job_security`, `compensation_signals`, `growth_opportunities`, `workforce_geography`, `h1b_and_visa_dependency`, `watch_items[]`.

**When to edit:**
- Add new "signal categories" (currently 6: Job Security, Compensation, Growth, Culture, Workforce Geography, H-1B/Visa)
- Adjust how aggressively the model flags H-1B/visa concerns (currently scans for ~10 specific terms and flags reliance as a concern)
- Change the geographic-revenue-vs-headcount mismatch threshold (currently flags any noticeable disproportion)
- Add or remove the "show your work" requirement that forces the model to quote raw filing text

**Input data:** filing JSON + optional `riskFactors` text + optional `mdaText`.

---

### 3. Generic Filing Summary — [filing-summary.ts](../../packages/ai/src/prompts/filing-summary.ts)

**What it produces:** an older, simpler filing summary (executive summary, key numbers, plain-language explanation, red flags, opportunities, employee relevance). Newer code prefers `company-summary.ts` and `employee-impact.ts` instead.

**When to edit:** mostly legacy. Only edit if you're keeping the older summary path alive somewhere.

---

### 4. Section Summary — [section-summary.ts](../../packages/ai/src/prompts/section-summary.ts)

**What it produces:** a short (under 150 words) plain-text summary of a single filing section.

**Special structure:** uses a `SECTION_GUIDANCE` lookup table (lines 8–50) that switches behavior based on which section is being summarized:
- `riskFactors`
- `mdAndA`
- `businessOverview`
- `legalProceedings`
- `financialStatements`
- `executiveCompensation`

**When to edit:**
- To change how a *specific* section is summarized, edit only its entry in `SECTION_GUIDANCE` — leave the rest alone.
- To add a new section type, add a new key to `SECTION_GUIDANCE` and call `summarizeSection()` with that `sectionType`.
- The 150-word cap is in the system prompt at line 67.

---

### 5. MD&A Summary — [mda-summary.ts](../../packages/ai/src/prompts/mda-summary.ts)

**What it produces:** **markdown** (not JSON) — the structured MD&A card on the dashboard. Renders through `MarkdownContent` / `react-native-markdown-display`.

**Output structure (fixed in the prompt):**
- `## The Big Picture`
- `## Revenue & Growth`
- `## Profitability`
- `## Cash & Spending`
- `## Management's Outlook`
- `## Bottom Line for Workers`

**When to edit:**
- Add/remove sections by changing the markdown headers in the system prompt
- Change the 300–500 word total cap (line 47)
- Tweak the "translate corporate euphemisms bluntly" rule (line 45) — this is the prompt's most opinionated instruction

**Note:** The output is markdown, so any structural change has to keep the headers parseable.

---

### 6. Compensation Analysis — [compensation-analysis.ts](../../packages/ai/src/prompts/compensation-analysis.ts)

**What it produces:** the fairness gauge. Returns JSON with `fairness_score` (1–100), `explanation`, `comparisons[]`, `recommendations[]`.

**When to edit:**
- The scoring rubric is hardcoded in the system prompt (lines 27–32). Change those bands (currently 80–100 = fair, 1–19 = extreme disparity) to recalibrate the gauge.
- The S&P 500 reference ratio (~272:1) is in the system prompt at line 36 — update if it ages out.
- Adjust which 5 comparisons the model is forced to compute (lines 34–40).

**Input data:** exec comp JSON + optional user pay (in cents) + optional cost-of-living (cents/month) + optional company financials.

---

### 7. What This Means — [what-this-means.ts](../../packages/ai/src/prompts/what-this-means.ts)

**What it produces:** the personalized "explaining this to a friend over a beer" overlay. Plain-text prose, 1–3 paragraphs, no markdown.

**When to edit:**
- The "friend over a beer" framing (line 12) is the whole personality — replace this if you want a different vibe.
- The user profile is woven in via `userJobTitle`, `userAnnualPay`, `userIndustry`. Add new profile fields by extending `WhatThisMeansParams` and threading them through `whatThisMeansUserPrompt`.
- The mandatory "bottom line" sentence is enforced at line 27 — remove that rule if you want a softer ending.

---

### 8. RAG Answer — [rag-answer.ts](../../packages/ai/src/prompts/rag-answer.ts) ⚠️ AND [supabase/functions/ask/index.ts](../../supabase/functions/ask/index.ts#L32)

**What it produces:** the answer to a user's chat question, grounded in retrieved filing chunks.

**⚠️ DUPLICATED ACROSS TWO FILES — KEEP THEM IN SYNC:**

1. **[packages/ai/src/prompts/rag-answer.ts](../../packages/ai/src/prompts/rag-answer.ts)** — used by any Bun/Node-side caller of `ClaudeClient.ragQuery()`.
2. **[supabase/functions/ask/index.ts:32](../../supabase/functions/ask/index.ts#L32)** (constant `RAG_SYSTEM_PROMPT`) — the **production** path. The `/ask` Edge Function runs on Deno, which can't import the `@union/ai` package, so the prompt is copy-pasted there as a string literal.

The Edge Function copy is slightly more elaborate (it knows about source labels and instructs the model to synthesize across multiple sources). If you change one, change the other.

**When to edit:**
- Tighten or relax the "ONLY use provided context" rule (line 10 of `rag-answer.ts`)
- Change the answer length cap (currently 2–4 paragraphs)
- Change the citation behavior (currently "cite the filing or data source when possible")

---

## Editing Checklist

Before editing a prompt:

1. **Pick the right file from the table above.**
2. **Read the existing system prompt end-to-end.** These prompts are highly tuned — small wording changes have big effects on the model's output structure.
3. **If the prompt expects JSON output, do not change the field names.** Downstream code in `claude.ts` parses the JSON via `extractJson()` and the type is enforced (e.g. `CompanySummaryResult`, `CompensationAnalysisResult`). Adding a field is safe; renaming or removing one will break the UI.
4. **For the RAG prompt, edit BOTH files.** No exceptions.
5. **Test by re-running summarization on one company.** The seed script (`SEED.md`) is the easiest way to regenerate summaries against a single ticker without re-ingesting raw SEC data.

---

## Related Knobs (not prompts, but adjacent)

| Knob | Where | What it controls |
|---|---|---|
| Default Claude model | [packages/ai/src/claude.ts:42](../../packages/ai/src/claude.ts#L42) (`DEFAULT_MODEL`) | Which Claude model runs all prompts (currently `claude-haiku-4-5`) |
| Default max output tokens | [packages/ai/src/claude.ts:43](../../packages/ai/src/claude.ts#L43) (`DEFAULT_MAX_TOKENS`) | Cap on response length (4096); some prompts override (MD&A uses 3072, section/RAG/what-this-means use 2048) |
| Input truncation cap | [packages/ai/src/claude.ts:371](../../packages/ai/src/claude.ts#L371) (`truncateForContext`) | How much filing data gets sent to the model (~100k chars) |
| Voyage embedding model | [packages/ai/src/claude.ts:46](../../packages/ai/src/claude.ts#L46) (`DEFAULT_VOYAGE_EMBEDDING_MODEL`) | Embedding model for RAG retrieval (`voyage-4-lite` dev, `voyage-finance-2` prod) |
| Summary version | `CompanySummaryCard` (`CURRENT_SUMMARY_VERSION = 2`) | If you make a breaking change to a JSON shape, bump this so old summaries get re-rendered correctly |
