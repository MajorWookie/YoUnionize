import { auth } from './auth'

export async function authHandler(request: Request): Promise<Response> {
  return auth.handler(request)
}
