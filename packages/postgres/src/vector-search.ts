import { sql, and, eq, type SQL } from 'drizzle-orm'
import { getDb } from './database'
import { embeddings } from './schema/embeddings'

export interface VectorSearchFilters {
  companyId?: string
  filingType?: string
  sourceType?: string
}

export interface VectorSearchResult {
  id: string
  sourceType: string
  sourceId: string
  contentHash: string
  metadata: Record<string, unknown> | null
  similarity: number
}

/**
 * Find embeddings similar to the query vector using pgvector cosine distance.
 * Returns results ranked by similarity (highest first).
 *
 * Uses: 1 - (embedding <=> query_embedding) for cosine similarity.
 */
export async function findSimilarEmbeddings({
  queryEmbedding,
  limit = 5,
  filters,
}: {
  queryEmbedding: Array<number>
  limit?: number
  filters?: VectorSearchFilters
}): Promise<Array<VectorSearchResult>> {
  const db = getDb()
  const vectorStr = `[${queryEmbedding.join(',')}]`

  // Build WHERE conditions
  const conditions: Array<SQL> = []

  if (filters?.sourceType) {
    conditions.push(eq(embeddings.sourceType, filters.sourceType))
  }

  // For companyId and filingType, filter via JSONB metadata
  if (filters?.companyId) {
    conditions.push(
      sql`${embeddings.metadata}->>'companyId' = ${filters.companyId}`,
    )
  }

  if (filters?.filingType) {
    conditions.push(
      sql`${embeddings.metadata}->>'filingType' = ${filters.filingType}`,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Use raw SQL for the cosine distance operator since drizzle doesn't support it natively
  const results = await db.execute(sql`
    SELECT
      id,
      source_type,
      source_id,
      content_hash,
      metadata,
      1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM embeddings
    ${whereClause ? sql`WHERE ${whereClause}` : sql``}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `)

  return (results as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    sourceType: row.source_type as string,
    sourceId: row.source_id as string,
    contentHash: row.content_hash as string,
    metadata: row.metadata as Record<string, unknown> | null,
    similarity: Number(row.similarity),
  }))
}
