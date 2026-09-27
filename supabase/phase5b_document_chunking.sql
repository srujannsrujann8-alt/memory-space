-- ==============================================================================
-- MEMORYSPACE — PHASE 5B DATABASE SETUP: DOCUMENT TEXT CHUNKING
-- Run this script in your Supabase Dashboard:
-- SQL Editor -> New Query -> Paste & Run
-- ==============================================================================

-- 1. Create document_chunks table
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    document_content_id UUID NOT NULL REFERENCES public.document_content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    character_count INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    page_number INTEGER,
    slide_number INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_document_chunks_content_index UNIQUE (document_content_id, chunk_index)
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS document_chunks_user_id_idx ON public.document_chunks(user_id);
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS document_chunks_document_content_id_idx ON public.document_chunks(document_content_id);
CREATE INDEX IF NOT EXISTS document_chunks_chunk_index_idx ON public.document_chunks(document_id, chunk_index);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- 4. Document Chunks RLS Policies (Strict User Isolation)
DROP POLICY IF EXISTS "Users can view their own document chunks" ON public.document_chunks;
CREATE POLICY "Users can view their own document chunks"
    ON public.document_chunks FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own document chunks" ON public.document_chunks;
CREATE POLICY "Users can insert their own document chunks"
    ON public.document_chunks FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own document chunks" ON public.document_chunks;
CREATE POLICY "Users can update their own document chunks"
    ON public.document_chunks FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own document chunks" ON public.document_chunks;
CREATE POLICY "Users can delete their own document chunks"
    ON public.document_chunks FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO authenticated;
