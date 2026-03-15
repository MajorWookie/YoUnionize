/**
 * Vitest global setup — runs before all tests.
 * Sets required environment variables for modules that check them at import time.
 */

process.env.DATABASE_URL ??= 'postgresql://union:union@localhost:5433/union'
process.env.SEC_API_KEY ??= 'test-sec-api-key'
process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key'
process.env.OPENAI_API_KEY ??= 'test-openai-key'
process.env.BETTER_AUTH_SECRET ??= 'test-better-auth-secret'
