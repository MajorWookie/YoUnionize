# ADR-001: Tamagui over Mantine for UI

- **Date**: 2026-03-14
- **Decision**: Stay on Tamagui 2.0 for cross-platform UI
- **Rationale**: App is iOS-first -> Android -> Web. Mantine/Chakra/Radix are web-only and cannot render native views. Tamagui provides native components on mobile and web components on browser from a single codebase.
- **Alternatives considered**: Mantine v8 (rejected -- web-only), NativeWind, Gluestack UI
- **Status**: Active
