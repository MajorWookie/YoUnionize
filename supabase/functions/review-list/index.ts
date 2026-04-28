// GET /functions/v1/review-list
//   ?ticker=AAPL                     (optional, filters to one company)
//   ?status=ai_generated,human_edited (optional, comma-separated; 'failed' is virtual)
//   ?limit=50                        (default 200)
//
// Returns the paginated review queue for the human review pipeline.

import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { ensureAuth } from '../_shared/auth.ts'
import { classifyError } from '../_shared/api-utils.ts'
import {
  ALL_STATUSES,
  listReviewItems,
  type SummarizationStatus,
} from '../_shared/review-pipeline.ts'

const VALID_STATUS_PARAMS = new Set<string>([...ALL_STATUSES, 'failed'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    await ensureAuth(req)
    const url = new URL(req.url)

    const ticker = url.searchParams.get('ticker') ?? undefined
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw ? Math.min(500, Math.max(1, Number.parseInt(limitRaw, 10) || 200)) : 200

    const statusParam = url.searchParams.get('status')
    const status = statusParam
      ? statusParam
          .split(',')
          .map((s) => s.trim())
          .filter((s) => VALID_STATUS_PARAMS.has(s))
      : undefined

    const items = await listReviewItems({
      ticker,
      status: status as ReadonlyArray<SummarizationStatus | 'failed'> | undefined,
      limit,
    })

    return jsonResponse({ items, count: items.length })
  } catch (err) {
    return classifyError(err)
  }
})
