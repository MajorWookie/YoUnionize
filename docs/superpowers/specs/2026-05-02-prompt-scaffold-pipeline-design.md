# Prompt Scaffold + Per-Section Optimization Pipeline — Design Spec

**Date:** 2026-05-02
**Status:** Approved
**Author:** Adrian Anderson + Claude (interactive design)
**Branch:** `feat/prompt-scaffold-foundation` (PR 1) → per-section PRs after

## Goal

Resume the Phase 3 prompt-optimization effort that PR #60 (merged 2026-04-30) prepared the eval harness for. Replace the 12 per-section SEC summary prompts one at a time with content tuned for higher rubric scores against a frozen v1 baseline.

## Decisions

### D1. All 12 sections use a single shared scaffold with a typed options schema

`packages/ai/src/prompts/_scaffold.ts` exports two pure functions used by every per-section module:

- `scaffoldSystemPrompt(opts: ScaffoldOptions): string` — composes a fixed `PERSONA` + the section's `GUIDANCE` + a fixed `UNIVERSAL_RULES` block + a per-section output-rules block built from the options.
- `scaffoldUserPrompt({ sectionLabel, section, companyName, filingType }): string` — wraps the source SEC text in `<sec_filing_section>...</sec_filing_section>` XML tags and ends with "Write your summary now."

`ScaffoldOptions` (the typed override schema):

```ts
interface ScaffoldOptions {
  guidance: string                                          // required, section-specific
  maxWords?: number                                         // default 150
  outputFormat?: 'plain' | 'structured-markdown' | 'json'   // default 'plain'
  requiredSections?: string[]                               // required when 'structured-markdown'
  jsonShape?: string                                        // required when 'json'
}
```

**10 sections use plain defaults** (`{ guidance: GUIDANCE }` only) — plain text, ≤150 words, no markdown headers, bullet points allowed. **MDA overrides** to `outputFormat: 'structured-markdown'` with its 6 required sections (`The Big Picture`, `Revenue & Growth`, `Profitability`, `Cash & Spending`, `Management's Outlook`, `Bottom Line for Workers`) and `maxWords: 500`. The MDA dashboard accordion at [src/routes/company.tsx:501-512](src/routes/company.tsx#L501-L512) renders the output through `<MarkdownContent>` and continues to surface the structured 6-section view as the most-prominent narrative on each company page. **Event-8K overrides** to `outputFormat: 'json'` with a `{ headline, summary }` schema for social-feed-style cards; `summarize8kEvent` parses the JSON and returns a typed `Event8kSummaryResult`. The pipeline persists the full object on `filing_sections.ai_summary` (JSONB) and extracts the markdown body for embedding text and the 8-K rollup aggregator.

The `UNIVERSAL_RULES` block (persona-adjacent, no overrides) holds: 6th-grade reading level, no jargon, bullets when listing, lead-with-takeaway, honesty, concision, source-fidelity. These are not section-overridable. If a future section needs to deviate from a universal rule, the right move is to expand `ScaffoldOptions` with a typed parameter for that axis — not to allow arbitrary rule overrides.

### D2. `priorMdaText` is removed

`MdaSummaryParams.priorMdaText` is dead code. Zero external callers (only in-package self-references). Drop it from the type, drop the conditional in `mdaSummaryUserPrompt`, drop it from `summarizeMda` in [packages/ai/src/claude.ts:298-315](packages/ai/src/claude.ts#L298-L315).

### D3. MDA's max_tokens stays at 3072

MDA's structured-markdown output targets ~500 words across 6 sections, so it keeps the original `3072` cap on `chat()`. The other 11 sections use `2048` (plenty for ≤150 words). The eval script's MDA branch matches.

### D4. PR scope: one foundation PR + 11 content PRs

**PR 1 (this PR):** Foundation. Creates `_scaffold.ts`, refactors all 12 modules to call it (preserving each module's existing GUIDANCE content byte-equivalent for the 11 non-MDA sections; rewriting MDA's GUIDANCE to fit the ≤150-word constraint). Bumps all 12 `PROMPT_VERSIONS` from `@v1` to `@v2`. Empties `EXPECT_BYTE_EQUAL`. The structural change (XML wrapper + closer + new framing) is a behavior change for all 12 — version bump is required.

**PRs 2–12:** Per-section content tuning, alphabetical:
- business_overview, controls_and_procedures, cybersecurity, event_8k, executive_compensation, financial_footnotes, legal_proceedings, narrative, proxy, related_transactions, risk_factors

Each content PR: edits one `GUIDANCE` constant, adds section-specific content guardrails, bumps that section's version `@v2 → @v3`, runs the eval, attaches the rubric report.

### D5. Eval-then-decide loop per section

For each per-section PR after PR 1:
1. Run `bun run eval:section --kind <kind> --limit 5` against `.env.remote`.
2. Score the resulting markdown report on the 1–5 rubric (accuracy, employee relevance, specificity, readability, structure).
3. **Decision rule** (built into the eval harness): avg lift ≥0.5 → ship; 0.3–0.5 → iterate within PR; <0.3 → revert.

## Files touched (PR 1)

**New:**
- `packages/ai/src/prompts/_scaffold.ts`
- `docs/superpowers/specs/2026-05-02-prompt-scaffold-pipeline-design.md` (this file)

**Modified:**
- `packages/ai/src/prompts/business-overview.ts`
- `packages/ai/src/prompts/controls-and-procedures.ts`
- `packages/ai/src/prompts/cybersecurity.ts`
- `packages/ai/src/prompts/event-8k.ts`
- `packages/ai/src/prompts/executive-compensation.ts`
- `packages/ai/src/prompts/financial-footnotes.ts`
- `packages/ai/src/prompts/legal-proceedings.ts`
- `packages/ai/src/prompts/mda-summary.ts` (also drops `priorMdaText`)
- `packages/ai/src/prompts/narrative.ts`
- `packages/ai/src/prompts/proxy.ts`
- `packages/ai/src/prompts/related-transactions.ts`
- `packages/ai/src/prompts/risk-factors.ts`
- `packages/ai/src/claude.ts` (drops `priorMdaText` from `summarizeMda`; max_tokens 3072 → 2048)
- `packages/sec-api/src/section-prompts.ts` (`PROMPT_VERSIONS`: all 12 `@v1 → @v2`)
- `scripts/eval/__tests__/v1-section-prompts.test.ts` (`EXPECT_BYTE_EQUAL` → empty set)
- `CLAUDE.md` (remove "no prior-period plumbing except for mda" exception)

## Verification

- `bun run typecheck` passes
- `bun run lint` passes (0 warnings, 0 errors)
- `bun test` passes; the byte-equality guard now has 0 byte-equal kinds and only the keyset assertion remains active
- `bun run eval:section --kind <kind> --limit 5` per kind, attach reports to PR (these are sanity checks for PR 1 since content didn't change for 11/12, only structure changed; for MDA, the rubric will tell us whether the conformance is a regression)

## Risks

- **The 12-version bump triggers re-summarization of every existing summarized section on the next batch run.** This is expensive but unavoidable: the structural change (XML wrapper + closer + parameterized output rules) materially changes output, so old summaries are stale.
- **MDA's structured-markdown shape is now expressed as data, not as a forked prompt.** The 6 required sections live in `REQUIRED_SECTIONS` in `mda-summary.ts`. Any change to the section list or order is a content change that requires re-running the eval; the scaffold itself stays untouched.

## Out of scope

- Content tuning of any of the 11 non-MDA sections (deferred to PRs 2–12).
- Changes to the eval harness itself.
- Re-summarization batch run (the version bump just enables it; the actual run happens later).
- Cleanup of the v1 fixture or the byte-equality test once Phase 3 is fully shipped (deferred until all 12 PRs land).
