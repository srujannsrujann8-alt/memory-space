-- ==============================================================================
-- MEMORYSPACE — PHASE 5C DATABASE SETUP: DOCUMENT CHUNK EMBEDDINGS (pgvector)
-- Provider: Google Gemini
-- Model: text-embedding-004
-- Dimension: 768
-- Run this script in your Supabase Dashboard:
-- SQL Editor -> New Query -> Paste & Run
-- ==============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding vector and metadata columns to public.document_chunks
ALTER TABLE public.document_chunks
ADD COLUMN IF NOT EXISTS embedding vector(768),
ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-004',
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS embedding_error TEXT,
ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

-- 3. Add constraint for valid embedding status
ALTER TABLE public.document_chunks 
DROP CONSTRAINT IF EXISTS chk_chunks_embedding_status;

ALTER TABLE public.document_chunks 
ADD CONSTRAINT chk_chunks_embedding_status 
CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed'));

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_status 
ON public.document_chunks(embedding_status);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedded_at 
ON public.document_chunks(embedded_at DESC);

-- Optional IVFFlat or HNSW index can be created once sufficient rows exist:
-- CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw 
-- ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

-- 5. Ensure RLS remains enabled and permissions granted
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO authenticated;
