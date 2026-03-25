# ADR-006: Expo Router over One Framework

- **Date**: 2026-03-17
- **Decision**: Migrate from One Framework/VXRN to Expo Router for frontend routing
- **Rationale**: One Framework's native bridge (VXRN) caused opaque iOS build failures, had sparse docs, and small community. Expo Router is mature, well-documented, and provides all the same routing features. The only One-specific feature (API routes) is now handled by Supabase Edge Functions.
- **Alternatives considered**: One Framework (migrated away from), React Navigation standalone
- **Status**: Active
