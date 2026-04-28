// POST   /functions/v1/review-raw-override   { filingId, override, expectedLockVersion }
// DELETE /functions/v1/review-raw-override   { filingId, expectedLockVersion }
//
// Apply or clear raw_data_override. Setting an override sets summary_version
// to 0 so the next summarize run picks up the edited payload; status is left
// alone until that re-run completes.

import * as v from 'valibot'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { ensureAuth } from '../_shared/auth.ts'
import {
  badRequest,
  classifyError,
  notFound,
  validationError,
} from '../_shared/api-utils.ts'
import { corsHeaders } from '../_shared/cors.ts'
import {
  applyRawOverride,
  clearRawOverride,
  OptimisticLockError,
  ReviewNotFoundError,
} from '../_shared/review-pipeline.ts'

const ApplySchema = v.object({
  filingId: v.pipe(v.string(), v.uuid()),
  override: v.record(v.string(), v.unknown()),
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
      await applyRawOverride(
        {
          filingId: parsed.output.filingId,
          expectedLockVersion: parsed.output.expectedLockVersion,
          actor,
        },
        parsed.output.override,
      )
      return jsonResponse({ ok: true, filingId: parsed.output.filingId })
    }

    if (req.method === 'DELETE') {
      const body = await req.json()
      const parsed = v.safeParse(ClearSchema, body)
      if (!parsed.success) {
        return validationError('Validation failed', parsed.issues.map((i) => i.message))
      }
      await clearRawOverride({
        filingId: parsed.output.filingId,
        expectedLockVersion: parsed.output.expectedLockVersion,
        actor,
      })
      return jsonResponse({ ok: true, filingId: parsed.output.filingId })
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
