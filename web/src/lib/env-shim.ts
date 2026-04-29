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

// Mirror both VITE_* and EXPO_PUBLIC_* keys from import.meta.env into process.env
// so shared packages (which read process.env directly) work without caring about
// which framework's convention populated the values.
const KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_KEY',
  'VITE_DEV_SKIP_AUTH',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_KEY',
  'EXPO_PUBLIC_DEV_SKIP_AUTH',
] as const

for (const k of KEYS) {
  const v = meta[k]
  if (v !== undefined && v !== '') env[k] = v
}

// useAuth reads EXPO_PUBLIC_DEV_SKIP_AUTH; if only VITE_DEV_SKIP_AUTH is set,
// mirror it so the auth-bypass flag still resolves correctly on web.
if (env.EXPO_PUBLIC_DEV_SKIP_AUTH === undefined && env.VITE_DEV_SKIP_AUTH !== undefined) {
  env.EXPO_PUBLIC_DEV_SKIP_AUTH = env.VITE_DEV_SKIP_AUTH
}
