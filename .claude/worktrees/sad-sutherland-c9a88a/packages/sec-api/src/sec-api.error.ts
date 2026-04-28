export class SecApiError extends Error {
  readonly statusCode: number
  readonly responseBody: string

  constructor(statusCode: number, responseBody: string, url: string) {
    super(`SEC API request failed: ${statusCode} ${url}`)
    this.name = 'SecApiError'
    this.statusCode = statusCode
    this.responseBody = responseBody
  }
}
