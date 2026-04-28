// POST   /functions/v1/review-summary   { filingId, humanSummary, expectedLockVersion }
// DELETE /functions/v1/review-summary   { filingId, expectedLockVersion }
//
// Apply or clear a human edit of the summary. Status is computed server-side
// from the value-only diff against ai_summary (the AI baseline, never edited
// by humans). Returns the resulting status and the change ratio so the
// caller can show the user what just happened.
//
// ai_summary is intentionally read-only here — it remains the AI baseline
// the diff compares against. Only AI runs (in summarize-pipeline) write it.

import * as v from 'valibot'
import { handleCors, jsonResponse, corsHeaders } from '../_shared/cors.ts'
import { ensureAuth } from '../_shared/auth.ts'
import {
  badRequest,
  classifyError,
  notFound,
  validationError,
} from '../_shared/api-utils.ts'
import {
  applyHumanSummary,
  clearHumanSummary,
  getReviewItem,
  OptimisticLockError,
  ReviewNotFoundError,
} from '../_shared/review-pipeline.ts'
import {
  HUMAN_AUTHORED_THRESHOLD,
  statusFromEdit,
} from '../_shared/review-diff.ts'

const ApplySchema = v.object({
  filingId: v.pipe(v.string(), v.uuid()),
  humanSummary: v.record(v.string(), v.unknown()),
  expectedLockVersion: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

const ClearSchema = v.object({
  filingId: v.pipe(v.string(), v.uuid()),
  expectedLockVersion: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

function conflictResponse(message: string, details: unknown) {
  return new Response(
    JSON.stringify({ error: { code: 'CONFLICT', message, details } }),
    {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors()

  try {
    const session = await ensureAuth(req)
    const actor = session.user.id

    if (req.method === 'POST') {
      const body = await req.json()
      const parsed = v.safeParse(ApplySchema, body)
      if (!parsed.success) {
        return validationError('Validation failed', parsed.issues.map((i) => i.message))
      }

      // Load the current row so we can diff the edit against ai_summary.
      const item = await getReviewItem(parsed.output.filingId)
      if (!item.aiSummary) {
        // No AI baseline yet — the user is authoring from scratch.
        await applyHumanSummary(
          {
            filingId: parsed.output.filingId,
            expectedLockVersion: parsed.output.expectedLockVersion,
            actor,
          },
          parsed.output.humanSummary,
          'human_authored',
        )
        return jsonResponse({
          ok: true,
          filingId: parsed.output.filingId,
          status: 'human_authored',
          changeRatio: 1,
          humanAuthoredThreshold: HUMAN_AUTHORED_THRESHOLD,
        })
      }

      const { status, changeRatio } = statusFromEdit(
        item.aiSummary,
        parsed.output.humanSummary,
      )

      await applyHumanSummary(
        {
          filingId: parsed.output.filingId,
          expectedLockVersion: parsed.output.expectedLockVersion,
          actor,
        },
        parsed.output.humanSummary,
        status,
      )

      return jsonResponse({
        ok: true,
        filingId: parsed.output.filingId,
        status,
        changeRatio,
        humanAuthoredThreshold: HUMAN_AUTHORED_THRESHOLD,
      })
    }

    if (req.method === 'DELETE') {
      const body = await req.json()
      const parsed = v.safeParse(ClearSchema, body)
      if (!parsed.success) {
        return validationError('Validation failed', parsed.issues.map((i) => i.message))
      }
      await clearHumanSummary({
        filingId: parsed.output.filingId,
        expectedLockVersion: parsed.output.expectedLockVersion,
        actor,
      })
      return jsonResponse({
        ok: true,
        filingId: parsed.output.filingId,
        status: 'ai_generated',
      })
    }

    return badRequest(`Method ${req.method} not allowed`)
  } catch (err) {
    if (err instanceof ReviewNotFoundError) return notFound(err.message)
    if (err instanceof OptimisticLockError) {
      return conflictResponse(err.message, {
        expected: err.expected,
        actual: err.actual,
      })
    }
    return classifyError(err)
  }
})
