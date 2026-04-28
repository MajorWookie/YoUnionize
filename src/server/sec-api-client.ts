import { SecApiClient } from '@younionize/sec-api'

let client: SecApiClient | undefined

export function getSecApiClient(): SecApiClient {
  if (!client) {
    const apiKey = process.env.SEC_API_KEY
    if (!apiKey) {
      throw new Error('SEC_API_KEY environment variable is not set')
    }
    client = new SecApiClient({ apiKey })
  }
  return client
}
