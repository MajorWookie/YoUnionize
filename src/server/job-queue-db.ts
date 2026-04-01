import { eq, sql } from 'drizzle-orm'
import { getDb } from '@union/postgres'
import { jobs } from '../database/schema/jobs'

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'
export type JobType = 'ingest' | 'summarize'

export interface Job {
  id: string
  type: string
  payload: unknown
  status: JobStatus
  result: unknown
  error: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

/**
 * Insert a new job row and return the job ID.
 * Does NOT execute the task — a separate worker polls for pending jobs.
 */
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
): Promise<string> {
  const db = getDb()
  const [row] = await db
    .insert(jobs)
    .values({ type, payload })
    .returning({ id: jobs.id })

  console.info(`[JobQueue] Enqueued ${type} job ${row.id}`)
  return row.id
}

/** Get a job by ID. */
export async function getJob(id: string): Promise<Job | undefined> {
  const db = getDb()
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  return row ? mapRow(row) : undefined
}

/**
 * Atomically claim a pending job for processing.
 * Returns the job if claimed, undefined if no pending job with that ID.
 */
export async function claimJob(id: string): Promise<Job | undefined> {
  const db = getDb()
  const [row] = await db
    .update(jobs)
    .set({
      status: 'running',
      startedAt: sql`now()`,
    })
    .where(eq(jobs.id, id))
    .returning()

  return row ? mapRow(row) : undefined
}

/** Mark a job as completed with its result. */
export async function completeJob(
  id: string,
  result: unknown,
): Promise<void> {
  const db = getDb()
  await db
    .update(jobs)
    .set({
      status: 'completed',
      result: result as Record<string, unknown>,
      completedAt: sql`now()`,
    })
    .where(eq(jobs.id, id))
}

/** Mark a job as failed with an error message. */
export async function failJob(id: string, error: string): Promise<void> {
  const db = getDb()
  await db
    .update(jobs)
    .set({
      status: 'failed',
      error,
      completedAt: sql`now()`,
    })
    .where(eq(jobs.id, id))
}

/** List pending jobs, optionally filtered by type. */
export async function listPendingJobs(type?: JobType): Promise<Array<Job>> {
  const db = getDb()
  const query = db
    .select()
    .from(jobs)
    .where(
      type
        ? sql`${jobs.status} = 'pending' AND ${jobs.type} = ${type}`
        : eq(jobs.status, 'pending'),
    )
    .orderBy(jobs.createdAt)

  const rows = await query
  return rows.map(mapRow)
}

function mapRow(row: typeof jobs.$inferSelect): Job {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    status: row.status as JobStatus,
    result: row.result,
    error: row.error,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  }
}
