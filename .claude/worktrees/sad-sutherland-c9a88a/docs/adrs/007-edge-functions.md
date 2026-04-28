# ADR-007: Supabase Edge Functions for API layer

- **Date**: 2026-03-17
- **Decision**: Move all API endpoints from One's `+api.ts` routes to Supabase Edge Functions (Deno)
- **Rationale**: API logic shouldn't live inside the frontend framework. Supabase Edge Functions consolidate on existing Supabase infrastructure, run on Deno (Bun-independent), and deploy independently from the mobile app. Database driver switched from `node-postgres` to `postgres-js` for Deno compatibility.
- **Alternatives considered**: Standalone Bun/Hono server, AWS Lambda API Gateway
- **Status**: Active
