import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need fresh module state for each test since job-queue uses module-level Map
let enqueueJob: typeof import('./job-queue').enqueueJob
let getJob: typeof import('./job-queue').getJob
let listJobs: typeof import('./job-queue').listJobs
let pruneJobs: typeof import('./job-queue').pruneJobs

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('./job-queue')
  enqueueJob = mod.enqueueJob
  getJob = mod.getJob
  listJobs = mod.listJobs
  pruneJobs = mod.pruneJobs
})

describe('job-queue', () => {
  describe('enqueueJob', () => {
    it('returns a job ID immediately', () => {
      const id = enqueueJob(async () => 'result')
      expect(id).toMatch(/^job_\d+_\d+$/)
    })

    it('job starts as pending', () => {
      const id = enqueueJob(async () => {
        await new Promise((r) => setTimeout(r, 1000))
        return 'result'
      })
      const job = getJob(id)
      expect(job).toBeDefined()
      // On first tick it may already be running, but initially it's pending or running
      expect(['pending', 'running']).toContain(job!.status)
    })

    it('job transitions to completed on success', async () => {
      const id = enqueueJob(async () => 42)
      // Wait for the async task to finish
      await new Promise((r) => setTimeout(r, 50))

      const job = getJob(id)
      expect(job!.status).toBe('completed')
      expect(job!.result).toBe(42)
      expect(job!.error).toBeNull()
      expect(job!.completedAt).toBeDefined()
    })

    it('job transitions to failed on error', async () => {
      vi.spyOn(console, 'info').mockImplementation(() => {})

      const id = enqueueJob(async () => {
        throw new Error('task failed')
      })
      await new Promise((r) => setTimeout(r, 50))

      const job = getJob(id)
      expect(job!.status).toBe('failed')
      expect(job!.error).toBe('task failed')
      expect(job!.completedAt).toBeDefined()
    })

    it('captures non-Error thrown values', async () => {
      vi.spyOn(console, 'info').mockImplementation(() => {})

      const id = enqueueJob(async () => {
        throw 'string error'
      })
      await new Promise((r) => setTimeout(r, 50))

      const job = getJob(id)
      expect(job!.error).toBe('string error')
    })
  })

  describe('getJob', () => {
    it('returns undefined for non-existent IDs', () => {
      expect(getJob('nonexistent')).toBeUndefined()
    })
  })

  describe('listJobs', () => {
    it('returns all jobs', async () => {
      enqueueJob(async () => 'a')
      enqueueJob(async () => 'b')
      await new Promise((r) => setTimeout(r, 50))

      const all = listJobs()
      expect(all.length).toBeGreaterThanOrEqual(2)
    })

    it('filters by status', async () => {
      enqueueJob(async () => 'done')
      await new Promise((r) => setTimeout(r, 50))

      const completed = listJobs('completed')
      expect(completed.length).toBeGreaterThanOrEqual(1)
      for (const j of completed) {
        expect(j.status).toBe('completed')
      }
    })
  })

  describe('pruneJobs', () => {
    it('removes completed jobs older than maxAge', async () => {
      enqueueJob(async () => 'old')
      await new Promise((r) => setTimeout(r, 50))

      // Prune with maxAge 0 (everything is "old")
      const pruned = pruneJobs(0)
      expect(pruned).toBeGreaterThanOrEqual(1)
      expect(listJobs('completed')).toHaveLength(0)
    })

    it('does not prune running jobs', async () => {
      // Create a long-running job
      enqueueJob(
        () => new Promise((r) => setTimeout(r, 5000)),
      )
      await new Promise((r) => setTimeout(r, 20))

      const pruned = pruneJobs(0)
      expect(pruned).toBe(0)
    })
  })
})
