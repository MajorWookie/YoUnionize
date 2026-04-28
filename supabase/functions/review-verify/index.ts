// POST /functions/v1/review-verify   { filingId, expectedLockVersion }
//
// Marks the AI-generated summary as human_verified without modifying its
// content. This is the "I read it and it's fine" action — the seam between
// ai_generated (untouched) and human_verified (reviewed and approved).

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
  markVerified,
  OptimisticLockError,
  ReviewNotFoundError,
} from '../_shared/review-pipeline.ts'

const Schema = v.object({
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

    if (req.method !== 'POST') return badRequest(`Method ${req.method} not allowed`)

    const body = await req.json()
    const parsed = v.safeParse(Schema, body)
    if (!parsed.success) {
      return validationError('Validation failed', parsed.issues.map((i) => i.message))
    }

    await markVerified({
      filingId: parsed.output.filingId,
      expectedLockVersion: parsed.output.expectedLockVersion,
      actor,
    })

    return jsonResponse({
      ok: true,
      filingId: parsed.output.filingId,
      status: 'human_verified',
    })
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
