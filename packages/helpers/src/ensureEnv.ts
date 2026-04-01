/**
 * Returns the value of an environment variable or throws if it is not set.
 */
export function ensureEnv(key: string): string {
  const value = process.env[key]
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}
