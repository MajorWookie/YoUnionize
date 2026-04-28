/**
 * Run an async mapper over items with bounded concurrency.
 *
 * Similar to `Promise.all(items.map(fn))` but limits how many are in-flight
 * at once — essential for respecting API rate limits.
 */
export async function pMap<T, R>(
  items: ReadonlyArray<T>,
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<Array<R>> {
  const results: Array<R> = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await mapper(items[index], index)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}

/**
 * Like pMap but uses Promise.allSettled semantics — never rejects,
 * returns fulfilled/rejected results for each item.
 */
export async function pMapSettled<T, R>(
  items: ReadonlyArray<T>,
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++
      try {
        const value = await mapper(items[index], index)
        results[index] = { status: 'fulfilled', value }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}
