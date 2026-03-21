/**
 * Vitest global setup — runs before all tests.
 * Sets required environment variables for modules that check them at import time.
 */

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
process.env.SEC_API_KEY ??= 'test-sec-api-key'
process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key'
process.env.VOYAGE_API_KEY ??= 'test-voyage-key'
process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321'
process.env.SUPABASE_ANON_KEY ??= 'test-supabase-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-supabase-service-role-key'
