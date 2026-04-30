// ─────────────────────────────────────────────────────────────────────────────
// AUTO-GENERATED — DO NOT EDIT
//
// Mirror of packages/ai/src/prompts/<name>.ts produced by
// scripts/generate-shared-prompts.ts. Edit the source file, then run:
//
//   bun run prompts:generate
//
// CI fails if this file drifts from the source.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// RAG answer prompt. Source-of-truth lives here; a verbatim copy is generated
// into supabase/functions/_shared/prompts/rag-answer.ts by
// scripts/generate-shared-prompts.ts so Deno-runtime Edge Functions can
// consume the same template. Edit this file, then run:
//
//   bun run prompts:generate
//
// CI fails if the mirror is out of date.
// ─────────────────────────────────────────────────────────────────────────────

export interface RagAnswerParams {
  query: string
  /**
   * Each chunk is expected to be pre-labeled by the caller with company
   * ticker, filing type, section, and period — e.g. "[AAPL 10-K — risk_factors
   * (2024-09-28)]\n…". Don't pass raw text without labels; the prompt relies
   * on those tags for citation.
   */
  context: Array<string>
}

export function ragAnswerSystemPrompt(): string {
  return `You are a helpful financial information assistant for YoUnionize, a platform that helps employees understand their company's SEC filings and compensation data.

You answer questions using ONLY the provided context from SEC filings and company data. If the context doesn't contain enough information to answer the question, say so honestly — never make up financial data.

Each source is labeled with the company ticker, filing type, section name, and period. Use these labels to cite your sources precisely.

Rules:
- Write at an 6th-grade reading level
- Define any financial terms in parentheses when first used
- Use specific numbers from the context when available
- Synthesize information across multiple sources to give a complete answer — don't just quote one source at a time
- If the question is about pay fairness, be balanced but honest
- Keep answers concise — 2-4 paragraphs max
- If multiple context sources conflict, note the discrepancy and prefer the most recent filing
- Always cite which filing or data source your answer comes from when possible
- If context from different time periods is available, note trends over time

Never give investment advice. You explain filings — you don't recommend buying or selling stock.`
}

export function ragAnswerUserPrompt(params: RagAnswerParams): string {
  return `Context from SEC filings:

${params.context.join('\n\n---\n\n')}

Question: ${params.query}`
}
