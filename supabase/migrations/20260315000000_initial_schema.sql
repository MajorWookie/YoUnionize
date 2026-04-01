-- Initial schema: all public tables for YoUnion app
-- Source of truth: src/database/schema/*.ts

-- Enable pgvector extension for embeddings (public schema for remote compatibility)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- ============================================================
-- User tables
-- ============================================================

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE ("email")
);

CREATE TABLE "user_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "job_title" text,
  "org_level_code" text,
  "gross_annual_pay" integer,
  "company_ticker" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_profiles_user_id_unique" UNIQUE ("user_id"),
  CONSTRAINT "user_profiles_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE "user_cost_of_living" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "rent_mortgage" integer,
  "internet" integer,
  "mobile_phone" integer,
  "utilities" integer,
  "student_loans" integer,
  "consumer_debt" integer,
  "car_loan" integer,
  "groceries" integer,
  "gym" integer,
  "entertainment" integer,
  "clothing" integer,
  "savings_target" integer,
  "other" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_cost_of_living_user_id_unique" UNIQUE ("user_id"),
  CONSTRAINT "user_cost_of_living_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- ============================================================
-- Company tables
-- ============================================================

CREATE TABLE "companies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticker" text NOT NULL,
  "name" text NOT NULL,
  "cik" text NOT NULL,
  "sector" text,
  "industry" text,
  "exchange" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "companies_ticker_unique" UNIQUE ("ticker"),
  CONSTRAINT "companies_cik_unique" UNIQUE ("cik")
);

CREATE TABLE "filing_summaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "filing_type" text NOT NULL,
  "period_end" date,
  "filed_at" timestamp NOT NULL,
  "accession_number" text NOT NULL,
  "raw_data" jsonb NOT NULL,
  "ai_summary" jsonb,
  "summary_version" integer DEFAULT 1,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "filing_summaries_accession_number_unique" UNIQUE ("accession_number"),
  CONSTRAINT "filing_summaries_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "filing_summaries_company_type_period_idx"
  ON "filing_summaries" ("company_id", "filing_type", "period_end");

CREATE TABLE "executive_compensation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "filing_summary_id" uuid,
  "fiscal_year" integer NOT NULL,
  "executive_name" text NOT NULL,
  "title" text NOT NULL,
  "total_compensation" integer NOT NULL,
  "salary" integer,
  "bonus" integer,
  "stock_awards" integer,
  "option_awards" integer,
  "non_equity_incentive" integer,
  "other_compensation" integer,
  "ceo_pay_ratio" numeric,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "executive_compensation_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE,
  CONSTRAINT "executive_compensation_filing_summary_id_filing_summaries_id_fk"
    FOREIGN KEY ("filing_summary_id") REFERENCES "filing_summaries" ("id") ON DELETE SET NULL
);

CREATE TABLE "insider_trades" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "filer_name" text NOT NULL,
  "filer_title" text,
  "transaction_date" date NOT NULL,
  "transaction_type" text NOT NULL,
  "shares" numeric NOT NULL,
  "price_per_share" numeric,
  "total_value" integer,
  "filing_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "insider_trades_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE TABLE "directors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "title" text NOT NULL,
  "is_independent" boolean,
  "committees" jsonb,
  "tenure_start" date,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "directors_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE CASCADE
);

-- ============================================================
-- Embeddings (pgvector)
-- ============================================================

CREATE TABLE "embeddings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_type" text NOT NULL,
  "source_id" uuid NOT NULL,
  "content_hash" text NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "embeddings_hnsw_idx"
  ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);

-- ============================================================
-- Analysis & Jobs
-- ============================================================

CREATE TABLE "compensation_analyses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "analysis_data" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "compensation_analyses_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE TABLE "jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "result" jsonb,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp
);
