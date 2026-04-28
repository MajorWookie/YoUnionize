// GET /functions/v1/review-get?id=<filing_summary_id>
//
// Returns the full review item plus a value-only diff between ai_summary
// (baseline) and human_summary (current edit, if any). The diff is read-only
// here — review-summary computes it again at save time to decide status.

import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { ensureAuth } from '../_shared/auth.ts'
import { badRequest, classifyError, notFound } from '../_shared/api-utils.ts'
import {
  getReviewItem,
  ReviewNotFoundError,
} from '../_shared/review-pipeline.ts'
import {
  HUMAN_AUTHORED_THRESHOLD,
  summaryChangeRatio,
} from '../_shared/review-diff.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    await ensureAuth(req)
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) return badRequest('id query parameter is required')

    const item = await getReviewItem(id)

    const changeRatio = item.humanSummary
      ? summaryChangeRatio(item.aiSummary, item.humanSummary)
      : 0

    return jsonResponse({
      item,
      diff: {
        changeRatio,
        humanAuthoredThreshold: HUMAN_AUTHORED_THRESHOLD,
        wouldBeAuthored: changeRatio >= HUMAN_AUTHORED_THRESHOLD,
      },
    })
  } catch (err) {
    if (err instanceof ReviewNotFoundError) return notFound(err.message)
    return classifyError(err)
  }
})
