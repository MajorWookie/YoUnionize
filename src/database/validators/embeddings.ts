import * as v from 'valibot'

const sourceTypes = ['filing_section', 'ai_summary', 'user_context'] as const

export const InsertEmbeddingSchema = v.object({
  sourceType: v.picklist(sourceTypes),
  sourceId: v.pipe(v.string(), v.uuid()),
  contentHash: v.pipe(v.string(), v.minLength(1)),
  embedding: v.pipe(v.array(v.number()), v.length(1024)),
  metadata: v.optional(v.nullable(v.record(v.string(), v.unknown()))),
})

export type InsertEmbedding = v.InferOutput<typeof InsertEmbeddingSchema>
