export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Job {
  id: string
  status: JobStatus
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  result: unknown
  error: string | null
}

const jobs = new Map<string, Job>()

let jobCounter = 0

function generateJobId(): string {
  jobCounter++
  return `job_${Date.now()}_${jobCounter}`
}

/**
 * Enqueue an async task to run in the background.
 * Returns a job ID immediately that can be polled for status.
 */
export function enqueueJob(task: () => Promise<unknown>): string {
  const id = generateJobId()
  const job: Job = {
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    result: null,
    error: null,
  }
  jobs.set(id, job)

  // Fire-and-forget: run the task in the background
  void (async () => {
    job.status = 'running'
    job.startedAt = new Date().toISOString()
    try {
      job.result = await task()
      job.status = 'completed'
    } catch (err) {
      job.status = 'failed'
      job.error = err instanceof Error ? err.message : String(err)
      console.info(`[JobQueue] Job ${id} failed:`, job.error)
    } finally {
      job.completedAt = new Date().toISOString()
    }
  })()

  return id
}

/** Get the current state of a job by ID. */
export function getJob(id: string): Job | undefined {
  return jobs.get(id)
}

/** List all jobs (optionally filtered by status). */
export function listJobs(status?: JobStatus): Array<Job> {
  const all = Array.from(jobs.values())
  if (status) return all.filter((j) => j.status === status)
  return all
}

/** Clean up completed/failed jobs older than maxAgeMs (default: 1 hour). */
export function pruneJobs(maxAgeMs = 60 * 60 * 1000): number {
  const cutoff = Date.now() - maxAgeMs
  let pruned = 0
  for (const [id, job] of jobs) {
    if (
      (job.status === 'completed' || job.status === 'failed') &&
      job.completedAt &&
      new Date(job.completedAt).getTime() < cutoff
    ) {
      jobs.delete(id)
      pruned++
    }
  }
  return pruned
}
