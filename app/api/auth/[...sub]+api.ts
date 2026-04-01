/**
 * Auth is now handled by Supabase client-side.
 * This catch-all route returns 404 for any legacy auth API calls.
 */
export function GET() {
  return Response.json(
    { error: { code: 'NOT_FOUND', message: 'Auth is handled by Supabase client-side' } },
    { status: 404 },
  )
}

export function POST() {
  return Response.json(
    { error: { code: 'NOT_FOUND', message: 'Auth is handled by Supabase client-side' } },
    { status: 404 },
  )
}
