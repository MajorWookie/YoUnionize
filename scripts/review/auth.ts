// CLI auth module — logs the user in as a real Supabase user, caches the
// session at ~/.union/cli-session.json. The same access token is sent on
// every subsequent CLI command so review writes carry session.user.id as
// the actor — same shape Phase 2 UI will use.

import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

const SESSION_DIR = join(homedir(), '.union')
const SESSION_FILE = join(SESSION_DIR, 'cli-session.json')

export interface CliConfig {
  supabaseUrl: string
  supabaseKey: string
  edgeFunctionsBase: string
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super('Not authenticated. Run `bun run review login` first.')
    this.name = 'NotAuthenticatedError'
  }
}

export function loadCliConfig(): CliConfig {
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL
    ?? process.env.SUPABASE_URL
    ?? 'http://127.0.0.1:54321'
  const supabaseKey =
    process.env.EXPO_PUBLIC_SUPABASE_KEY
    ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.SUPABASE_KEY
    ?? process.env.SUPABASE_ANON_KEY
    ?? ''
  if (!supabaseKey) {
    throw new Error(
      'No Supabase publishable key found. Set EXPO_PUBLIC_SUPABASE_KEY in your .env.',
    )
  }
  return {
    supabaseUrl,
    supabaseKey,
    edgeFunctionsBase: `${supabaseUrl}/functions/v1`,
  }
}

let cachedClient: SupabaseClient | undefined

function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient
  const cfg = loadCliConfig()
  cachedClient = createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
  return cachedClient
}

interface StoredSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  userId: string
  email: string
}

async function readSessionFile(): Promise<StoredSession | null> {
  const file = Bun.file(SESSION_FILE)
  if (!(await file.exists())) return null
  try {
    return (await file.json()) as StoredSession
  } catch {
    return null
  }
}

async function writeSessionFile(s: StoredSession): Promise<void> {
  await mkdir(SESSION_DIR, { recursive: true, mode: 0o700 })
  await Bun.write(SESSION_FILE, JSON.stringify(s, null, 2))
  // Best-effort tighten permissions; ignore failures (Windows etc.).
  try {
    const { chmod } = await import('node:fs/promises')
    await chmod(SESSION_FILE, 0o600)
  } catch {}
}

async function deleteSessionFile(): Promise<void> {
  const { unlink } = await import('node:fs/promises')
  try {
    await unlink(SESSION_FILE)
  } catch {}
}

function sessionFromAuthResponse(s: Session): StoredSession {
  return {
    accessToken: s.access_token,
    refreshToken: s.refresh_token,
    expiresAt: s.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    userId: s.user.id,
    email: s.user.email ?? '',
  }
}

/**
 * Read user input from stdin without echoing (for password). Falls back to
 * echoing if the platform doesn't support raw mode (e.g., piped input).
 */
async function readPassword(prompt: string): Promise<string> {
  process.stdout.write(prompt)
  // Bun's prompt() echoes — we use a manual stdin read with raw mode to hide.
  const stdin = process.stdin
  if (!stdin.isTTY || !stdin.setRawMode) {
    return new Promise((resolve) => {
      let buf = ''
      stdin.once('data', (d) => {
        buf = d.toString().replace(/\r?\n$/, '')
        resolve(buf)
      })
    })
  }
  return new Promise((resolve) => {
    stdin.setRawMode(true)
    stdin.resume()
    let buf = ''
    const onData = (d: Buffer) => {
      const ch = d.toString()
      if (ch === '\n' || ch === '\r' || ch === '') {
        stdin.setRawMode(false)
        stdin.pause()
        stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(buf)
      } else if (ch === '') {
        // Ctrl-C
        process.exit(130)
      } else if (ch === '' || ch === '\b') {
        buf = buf.slice(0, -1)
      } else {
        buf += ch
      }
    }
    stdin.on('data', onData)
  })
}

async function readLine(prompt: string): Promise<string> {
  process.stdout.write(prompt)
  return new Promise((resolve) => {
    const stdin = process.stdin
    stdin.resume()
    stdin.once('data', (d) => {
      stdin.pause()
      resolve(d.toString().replace(/\r?\n$/, ''))
    })
  })
}

export async function login(opts?: { email?: string; password?: string }): Promise<StoredSession> {
  const email = opts?.email ?? (await readLine('Email: '))
  const password = opts?.password ?? (await readPassword('Password: '))

  const client = getClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Login failed: ${error.message}`)
  if (!data.session) throw new Error('Login returned no session')

  const stored = sessionFromAuthResponse(data.session)
  await writeSessionFile(stored)
  return stored
}

export async function logout(): Promise<void> {
  await deleteSessionFile()
}

/**
 * Loads the cached session, refreshing the access token if it's expired or
 * close to expiring. Throws NotAuthenticatedError if there's no session.
 */
export async function getActiveSession(): Promise<StoredSession> {
  const session = await readSessionFile()
  if (!session) throw new NotAuthenticatedError()

  const now = Math.floor(Date.now() / 1000)
  // Refresh if expired or within 60s of expiring.
  if (session.expiresAt - now > 60) return session

  const client = getClient()
  const { data, error } = await client.auth.refreshSession({
    refresh_token: session.refreshToken,
  })
  if (error || !data.session) {
    await deleteSessionFile()
    throw new NotAuthenticatedError()
  }
  const refreshed = sessionFromAuthResponse(data.session)
  await writeSessionFile(refreshed)
  return refreshed
}

export async function whoami(): Promise<{ userId: string; email: string } | null> {
  const session = await readSessionFile()
  if (!session) return null
  return { userId: session.userId, email: session.email }
}
