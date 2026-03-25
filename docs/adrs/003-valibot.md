# ADR-003: Valibot over Zod for validation

- **Date**: 2026-03-13
- **Decision**: Use Valibot for all runtime schema validation
- **Rationale**: Smaller bundle size than Zod, tree-shakeable, same type-inference capabilities. Important for a cross-platform app shipping to mobile.
- **Alternatives considered**: Zod
- **Status**: Active
