---
name: mantine
description: "Use when working with the Mantine UI library in the web/ workspace — components from @mantine/core, @mantine/hooks, @mantine/form, @mantine/notifications, @mantine/charts; theme configuration; styling via style props or CSS modules; PostCSS preset-mantine; the Vite + React Router web app under web/. Skip for iOS work — the Expo app uses Tamagui, not Mantine."
metadata:
  author: younionize
  version: "0.1.0"
---

# Mantine

## Core Principles

**1. Verify against bundled docs before relying on training data.**
Mantine ships breaking changes between major versions (the project currently uses v7). Provider APIs, theme structure, CSS variable naming, and PostCSS preset config have all shifted between v5 → v6 → v7. The bundled references in this skill are the version of record for this codebase — consult them first.

**2. iOS uses Tamagui, web uses Mantine — do not cross-port.**
Tamagui's primitives (`YStack`, `XStack`, `useTheme`, `$color9` tokens, `styled()` factory) are not interchangeable with Mantine's (`Stack`, `Group`, `useMantineTheme`, `theme.colors`, `createTheme`). When in `web/`, write Mantine. When in `app/` or `src/`, write Tamagui. If you find yourself reading a Tamagui component while writing a Mantine page, stop and translate the *intent*, not the syntax.

**3. Theme parity, not theme reuse.**
The web theme at [web/src/theme.ts](web/src/theme.ts) is a port of [src/tamagui/themes.ts](src/tamagui/themes.ts) into Mantine's `MantineColorsTuple` format — they are independent declarations of the same brand palette. When you change one palette, change the other so iOS and web look like the same product.

**4. Polymorphic components have type-system gotchas with react-router-dom.**
`<Title component={Link} to="...">` does not propagate Link's `to` prop through Mantine's polymorphic typing (a known v7 quirk). Use `<Anchor component={Link} to="...">` and style it title-like, or wrap a non-clickable Title inside a clickable Anchor. The codebase already follows this pattern in [web/src/components/Layout.tsx](web/src/components/Layout.tsx) and [web/src/components/AuthLayout.tsx](web/src/components/AuthLayout.tsx).

## Documentation access

The full Mantine v7 docs are bundled at `references/llms-full.md` (≈3.4 MB, 112k lines). It is far too large to load into context wholesale.

**Workflow:**

1. **Use `references/llms.md` as a sitemap.** It lists every Mantine doc page with a one-line description and a stable URL on `mantine.dev/llms/`. Open it first, grep for the topic (e.g. `grep -i 'donut\|chart' references/llms.md`), and identify the relevant page name.

2. **Read targeted sections from `references/llms-full.md`.** Once you know the topic, search the full doc for its heading anchor (e.g. `grep -n '^# DonutChart' references/llms-full.md`) and use `Read` with `offset` + `limit` to load just that section (typically 50-300 lines is enough).

3. **For very recent changes or version-specific questions**, fetch the canonical URL directly: `WebFetch https://mantine.dev/llms/<topic>.md`. The URL list is in `references/llms.md`.

**Do not** copy entire components from the docs into project files. Use the docs to learn the API, then write idiomatic code that fits the project's existing conventions.

## Project conventions (web/)

- **Theme**: [web/src/theme.ts](web/src/theme.ts). Primary color is `navy` — `theme.colors.navy[6]` is the brand shade. Secondary scales: `slate`, `green`, `red`.
- **Provider order** (in [web/src/App.tsx](web/src/App.tsx)): `MantineProvider` → `Notifications` → `SupabaseClientProvider` → `BrowserRouter`. Notifications must be inside MantineProvider; the Supabase context can be inside or outside MantineProvider but must wrap any route using `useAuth()`.
- **Auth**: consume via `useAuth()` from `@younionize/hooks`, not via direct Supabase client access. The hook resolves the client through `<SupabaseClientProvider>`.
- **API calls**: use `fetchWithRetry` / `apiFetch` from `@younionize/api-client`. Don't call `fetch` directly for `/api/*` paths — the helpers attach the Supabase apikey + Authorization headers.
- **Routing**: data-heavy routes are code-split via `React.lazy`. Landing + auth pages stay eager.
- **Styling**: prefer Mantine style props (`c="navy.6"`, `mt="md"`, `gap="xs"`) for one-offs; reach for CSS modules only when you need pseudo-classes, complex selectors, or styles that must scale across many components.

## Common tasks — quick pointers into the bundled docs

| Task | Where to look |
|------|---------------|
| New form | `references/llms.md` → "use-form" + "TextInput" / "PasswordInput" |
| Charts (bar, donut, line, area) | `references/llms.md` → "BarChart" / "DonutChart" / "LineChart" |
| Toasts | `references/llms.md` → "notifications" |
| Modal / drawer | `references/llms.md` → "Modal" / "Drawer" |
| Theme customization | `references/llms.md` → "theme-object" + "colors" + "MantineProvider" |
| Responsive layout | `references/llms.md` → "AppShell" + "Grid" + "media-queries" |
| Server-side rendering | `references/llms.md` → "ssr" + "next.js" (note: this project uses Vite, not Next; some SSR notes don't apply) |
