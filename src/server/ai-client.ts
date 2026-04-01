import { ClaudeClient } from '@union/ai'

let client: ClaudeClient | undefined

export function getAiClient(): ClaudeClient {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    }
    client = new ClaudeClient({
      apiKey,
      voyageApiKey: process.env.VOYAGE_API_KEY,
    })
  }
  return client
}
