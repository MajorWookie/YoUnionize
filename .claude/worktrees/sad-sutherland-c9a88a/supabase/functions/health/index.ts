import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors(req)

  return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() })
})
