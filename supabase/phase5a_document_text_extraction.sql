-- ==============================================================================
-- MEMORYSPACE — PHASE 5A DATABASE SETUP: DOCUMENT CONTENT & TEXT EXTRACTION
-- Run this script in your Supabase Dashboard:
-- SQL Editor -> New Query -> Paste & Run
-- ==============================================================================

-- 1. Create document_content table
CREATE TABLE IF NOT EXISTS public.document_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    extracted_text TEXT,
    extraction_status TEXT NOT NULL DEFAULT 'pending',
    extraction_error TEXT,
    extracted_at TIMESTAMPTZ,
    character_count INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_document_content_document_id UNIQUE (document_id),
    CONSTRAINT chk_extraction_status CHECK (
        extraction_status IN ('pending', 'processing', 'completed', 'failed', 'unsupported')
    )
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_document_content_document_id ON public.document_content(document_id);
CREATE INDEX IF NOT EXISTS idx_document_content_user_id ON public.document_content(user_id);
CREATE INDEX IF NOT EXISTS idx_document_content_status ON public.document_content(extraction_status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.document_content ENABLE ROW LEVEL SECURITY;

-- 4. Document Content RLS Policies (Strict User Isolation)
DROP POLICY IF EXISTS "Users can view their own document content" ON public.document_content;
CREATE POLICY "Users can view their own document content"
    ON public.document_content FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own document content" ON public.document_content;
CREATE POLICY "Users can insert their own document content"
    ON public.document_content FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own document content" ON public.document_content;
CREATE POLICY "Users can update their own document content"
    ON public.document_content FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own document content" ON public.document_content;
CREATE POLICY "Users can delete their own document content"
    ON public.document_content FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
