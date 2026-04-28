# ADR-009: Decouple SEC Data Fetching from LLM Processing

- **Date**: 2026-03-18
- **Decision**: Restructure the ingestion pipeline into two independent phases: (1) Fetch and store all raw SEC API responses verbatim in `raw_sec_responses` table, (2) Process raw data through transformers and LLMs as a separate step.
- **Rationale**: Current interleaved design means re-running LLM summarization requires re-fetching from SEC API, wastes API quota, and loses data that current transformers discard. Decoupling enables: re-processing without re-fetching, preserving all API data for future use, and batch operations across multiple companies.
- **New tables**: `raw_sec_responses` (verbatim API data lake), `form_8k_events` (structured 8-K events)
- **New endpoints**: `company-fetch` (Phase 1), `company-process` (Phase 2), `batch-fetch` (batch operations)
- **Bug fixes included**: Directors schema corrected (nested `data[].directors[]`), insider trading `totalValue` cents->dollars fix, derivative transactions now captured
- **Alternatives considered**: Extending `filing_summaries.rawData` (rejected -- compensation/directors are per-company, not per-filing), S3 for raw storage (rejected -- responses are JSON under 1MB, TOAST handles well)
- **Status**: Active
