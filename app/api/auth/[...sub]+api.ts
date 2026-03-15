import { authHandler } from '~/features/auth/server/handler'

export function GET(request: Request) {
  return authHandler(request)
}

export function POST(request: Request) {
  return authHandler(request)
}
