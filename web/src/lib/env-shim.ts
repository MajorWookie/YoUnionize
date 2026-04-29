/**
 * Polyfill `process.env` for shared packages.
 *
 * @younionize/api-client and @younionize/hooks read env vars via `process.env.*`,
 * which works in the Expo build (Babel inlines EXPO_PUBLIC_* keys) and Node, but
 * `process` is not defined globally in Vite's browser bundle. This shim runs
 * before any code that reads env vars and bridges Vite's `import.meta.env` into
 * the shape those packages expect.
 *
 * Must be imported FIRST in main.tsx, before any module that touches env vars.
 */
type ProcessLike = { env: Record<string, string | undefined> }

const g = globalThis as typeof globalThis & { process?: ProcessLike }
g.process = g.process ?? { env: {} }
const env = g.process.env

const meta = import.meta.env

if (meta.VITE_SUPABASE_URL) env.VITE_SUPABASE_URL = meta.VITE_SUPABASE_URL
if (meta.VITE_SUPABASE_KEY) env.VITE_SUPABASE_KEY = meta.VITE_SUPABASE_KEY
if (meta.VITE_DEV_SKIP_AUTH !== undefined) {
  env.VITE_DEV_SKIP_AUTH = meta.VITE_DEV_SKIP_AUTH
  // useAuth currently reads EXPO_PUBLIC_DEV_SKIP_AUTH; mirror until/unless that
  // hook is updated to fall back to VITE_DEV_SKIP_AUTH symmetrically.
  env.EXPO_PUBLIC_DEV_SKIP_AUTH = meta.VITE_DEV_SKIP_AUTH
}
