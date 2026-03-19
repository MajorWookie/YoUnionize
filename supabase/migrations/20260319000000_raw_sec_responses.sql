-- Migration: raw_sec_responses + form_8k_events + column additions
-- ADR-009: Decouple SEC Data Fetching from LLM Processing

-- ─── New Table: raw_sec_responses ──────────────────────────────────────────
-- Stores verbatim JSON from each SEC API call (data lake layer)

CREATE TABLE "raw_sec_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL,
  "sub_key" text,
  "raw_response" jsonb NOT NULL,
  "fetch_status" text NOT NULL DEFAULT 'complete',
  "fetch_error" text,
  "process_status" text NOT NULL DEFAULT 'pending',
  "processed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "raw_sec_company_endpoint_subkey_idx"
  ON "raw_sec_responses" ("company_id", "endpoint", COALESCE("sub_key", ''));

CREATE INDEX "raw_sec_process_status_idx"
  ON "raw_sec_responses" ("process_status") WHERE "process_status" = 'pending';

-- ─── New Table: form_8k_events ─────────────────────────────────────────────
-- Stores structured 8-K event data (auditor changes, restatements, personnel changes)

CREATE TABLE "form_8k_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "filing_summary_id" uuid REFERENCES "filing_summaries"("id") ON DELETE SET NULL,
  "accession_number" text NOT NULL,
  "filed_at" timestamp NOT NULL,
  "item_type" text NOT NULL,
  "event_data" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "form_8k_events_company_idx" ON "form_8k_events" ("company_id");
CREATE INDEX "form_8k_events_item_type_idx" ON "form_8k_events" ("item_type");
CREATE UNIQUE INDEX "form_8k_events_accession_item_idx"
  ON "form_8k_events" ("accession_number", "item_type");

-- ─── Column Changes: directors ─────────────────────────────────────────────
-- Add fields that were previously discarded from API responses.
-- Change tenure_start from date to text to preserve raw API values (e.g., "1997" vs "2000-11-01").

ALTER TABLE "directors"
  ALTER COLUMN "tenure_start" TYPE text USING "tenure_start"::text,
  ADD COLUMN IF NOT EXISTS "age" integer,
  ADD COLUMN IF NOT EXISTS "director_class" text,
  ADD COLUMN IF NOT EXISTS "qualifications" jsonb;

-- ─── Column Additions: insider_trades ──────────────────────────────────────
-- Add derivative transaction support and fix totalValue type

ALTER TABLE "insider_trades"
  ADD COLUMN IF NOT EXISTS "is_derivative" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "accession_number" text,
  ADD COLUMN IF NOT EXISTS "security_title" text,
  ADD COLUMN IF NOT EXISTS "shares_owned_after" numeric;

ALTER TABLE "insider_trades"
  ALTER COLUMN "total_value" TYPE bigint USING "total_value"::bigint;

-- ─── Column Additions: executive_compensation ──────────────────────────────
-- Add pension/deferred earnings field that was previously discarded

ALTER TABLE "executive_compensation"
  ADD COLUMN IF NOT EXISTS "change_in_pension_value" bigint;

-- ─── Column Additions: companies ───────────────────────────────────────────
-- Track when SEC data was last fetched

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "last_fetch_at" timestamp;

-- ─── Column Additions: jobs ────────────────────────────────────────────────
-- Support parent-child relationships for batch jobs

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "parent_job_id" uuid REFERENCES "jobs"("id");
