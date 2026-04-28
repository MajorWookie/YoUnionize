// $EDITOR-based JSON editing helper.
//
// Writes initial JSON to a temp file, spawns $EDITOR (falling back to nano),
// waits for the editor to exit, parses the result. Throws on parse failure
// so callers can either re-prompt or abort.
//
// Phase 2 UI replaces this with an HTTP endpoint that returns the JSON and
// accepts the edited version in a request body — the service layer doesn't
// know or care which.

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export class EditAbortedError extends Error {
  constructor(message = 'Edit aborted — file unchanged') {
    super(message)
    this.name = 'EditAbortedError'
  }
}

export class EditParseError extends Error {
  constructor(public readonly raw: string, public readonly cause: unknown) {
    super(`Edited content is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = 'EditParseError'
  }
}

export interface EditOptions {
  /** Filename hint used inside the temp dir (extension matters for editor syntax highlighting). */
  filename?: string
  /** Header comment lines prepended above the JSON, stripped before parsing. Use for guidance. */
  header?: ReadonlyArray<string>
}

const HEADER_PREFIX = '// '
const HEADER_SENTINEL = '// ─────── EDIT BELOW THIS LINE ───────'

function stripHeader(content: string): string {
  // If the sentinel is present, drop everything up to and including it.
  const idx = content.indexOf(HEADER_SENTINEL)
  if (idx >= 0) {
    const after = content.slice(idx + HEADER_SENTINEL.length)
    return after.replace(/^\r?\n/, '')
  }
  // Otherwise drop leading // comment lines.
  const lines = content.split(/\r?\n/)
  let i = 0
  while (i < lines.length && lines[i].trimStart().startsWith('//')) i++
  return lines.slice(i).join('\n').trimStart()
}

function buildFileContent(initial: unknown, header?: ReadonlyArray<string>): string {
  const headerLines = header && header.length > 0
    ? [...header.map((h) => `${HEADER_PREFIX}${h}`), HEADER_SENTINEL, '']
    : []
  return headerLines.join('\n') + JSON.stringify(initial, null, 2) + '\n'
}

async function spawnEditor(filePath: string): Promise<void> {
  const editor = process.env.EDITOR ?? process.env.VISUAL ?? 'nano'
  // Split on whitespace so EDITOR="code -w" works.
  const parts = editor.split(/\s+/)
  const cmd = parts[0]
  const args = [...parts.slice(1), filePath]

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new EditAbortedError(`Editor exited with code ${code}`))
    })
  })
}

/**
 * Open $EDITOR on a JSON value. Returns the parsed edited value.
 * Throws EditAbortedError if the user closed without saving any changes.
 * Throws EditParseError if the saved content isn't valid JSON.
 */
export async function editJson<T = unknown>(
  initial: unknown,
  opts: EditOptions = {},
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'union-review-'))
  const file = join(dir, opts.filename ?? 'edit.json')
  const initialContent = buildFileContent(initial, opts.header)
  await writeFile(file, initialContent, 'utf8')

  try {
    await spawnEditor(file)
    const after = await readFile(file, 'utf8')

    if (after === initialContent) {
      throw new EditAbortedError()
    }

    const stripped = stripHeader(after).trim()
    if (stripped.length === 0) {
      throw new EditAbortedError('File saved empty — treating as abort')
    }

    try {
      return JSON.parse(stripped) as T
    } catch (parseErr) {
      throw new EditParseError(stripped, parseErr)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
