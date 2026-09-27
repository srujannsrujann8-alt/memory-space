-- ==============================================================================
-- MEMORYSPACE — PHASE 6 DATABASE SETUP: VECTOR SIMILARITY SEARCH
-- Run this in the Supabase Dashboard: SQL Editor → New Query → Paste & Run
-- ==============================================================================

-- PHASE 6A: Verify/confirm pgvector is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ==============================================================================
-- PHASE 6B: Create the RPC function for vector similarity search
--
-- Security model:
--   SECURITY INVOKER (default) — function runs as the calling user.
--   auth.uid() enforces ownership: only chunks joined to documents the
--   authenticated user owns are ever returned.
--   No SECURITY DEFINER is needed because we do not need elevated permissions.
-- ==============================================================================

CREATE OR REPLACE FUNCTION search_document_chunks(
  query_embedding  vector(768),
  match_count      int     DEFAULT 5,
  similarity_floor float   DEFAULT 0.0
)
RETURNS TABLE (
  chunk_id      uuid,
  document_id   uuid,
  chunk_index   int,
  content       text,
  similarity    float,
  filename      text,
  category      text,
  file_type     text
)
LANGUAGE sql
STABLE
-- SECURITY INVOKER is the default — runs as the calling user, RLS is enforced
AS $$
  SELECT
    dc.id           AS chunk_id,
    dc.document_id  AS document_id,
    dc.chunk_index  AS chunk_index,
    dc.content      AS content,
    -- cosine similarity = 1 - cosine distance
    (1 - (dc.embedding <=> query_embedding))::float AS similarity,
    d.filename      AS filename,
    d.category      AS category,
    d.file_type     AS file_type
  FROM public.document_chunks dc
  INNER JOIN public.documents d
    ON d.id = dc.document_id
  WHERE
    dc.user_id = auth.uid()
    AND d.user_id = auth.uid()
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding)) >= similarity_floor
  ORDER BY dc.embedding <=> query_embedding ASC   -- closest distance first
  LIMIT match_count;
$$;

-- Grant execute to the authenticated role only
GRANT EXECUTE ON FUNCTION search_document_chunks(vector(768), int, float) TO authenticated;
-- Revoke from anon to prevent unauthenticated access
REVOKE EXECUTE ON FUNCTION search_document_chunks(vector(768), int, float) FROM anon;

-- ==============================================================================
-- PHASE 6I: Optional index for faster similarity search
-- For 39 chunks, exact scan (no index) is fine and more accurate.
-- Uncomment when chunk count exceeds ~1000.
-- ==============================================================================

-- CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
-- ON public.document_chunks USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- ==============================================================================
-- Verification query — run this after applying the migration:
-- ==============================================================================
-- SELECT proname, pronargs, prosecdef FROM pg_proc WHERE proname = 'search_document_chunks';
-- Expected: search_document_chunks | 3 | false   (false = SECURITY INVOKER, not DEFINER)
