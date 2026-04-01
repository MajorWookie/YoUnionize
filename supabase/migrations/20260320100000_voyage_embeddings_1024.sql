-- Migration: Switch embedding dimensions from 1536 (OpenAI) to 1024 (Voyage AI)
-- Existing embeddings are incompatible with the new dimension and must be regenerated.

-- Drop the HNSW index (must be rebuilt for new dimension)
DROP INDEX IF EXISTS embeddings_hnsw_idx;

-- Truncate all existing embeddings (1536-dim vectors cannot be used with 1024-dim column)
TRUNCATE embeddings;

-- Change vector dimension from 1536 to 1024
ALTER TABLE embeddings
  ALTER COLUMN embedding TYPE vector(1024);

-- Recreate the HNSW index for 1024 dimensions
CREATE INDEX embeddings_hnsw_idx
  ON embeddings USING hnsw (embedding vector_cosine_ops);
