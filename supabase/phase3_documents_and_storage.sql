-- ==============================================================================
-- MEMORYSPACE — PHASE 3 DATABASE & STORAGE SETUP
-- Run this entire script in your Supabase Dashboard:
-- SQL Editor -> New Query -> Paste & Run
-- ==============================================================================

-- 1. Create documents metadata table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    category TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Performance indexes for user documents and category filtering
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON public.documents(uploaded_at DESC);

-- 3. Enable Row Level Security (RLS) on documents table
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 4. Documents Table RLS Policies
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
CREATE POLICY "Users can view their own documents"
    ON public.documents FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents"
    ON public.documents FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents"
    ON public.documents FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents"
    ON public.documents FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Create storage bucket 'knowledge-files' (private bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'knowledge-files',
    'knowledge-files',
    false,
    52428800, -- 50 MB in bytes
    NULL      -- allows all types validated by frontend
)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS Policies for 'knowledge-files'
-- File paths are structured as: {user_id}/{filename}

DROP POLICY IF EXISTS "Users can upload their own knowledge files" ON storage.objects;
CREATE POLICY "Users can upload their own knowledge files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'knowledge-files' AND
        (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid()::text = split_part(name, '/', 1))
    );

DROP POLICY IF EXISTS "Users can read their own knowledge files" ON storage.objects;
CREATE POLICY "Users can read their own knowledge files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'knowledge-files' AND
        (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid()::text = split_part(name, '/', 1))
    );

DROP POLICY IF EXISTS "Users can update their own knowledge files" ON storage.objects;
CREATE POLICY "Users can update their own knowledge files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'knowledge-files' AND
        (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid()::text = split_part(name, '/', 1))
    );

DROP POLICY IF EXISTS "Users can delete their own knowledge files" ON storage.objects;
CREATE POLICY "Users can delete their own knowledge files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'knowledge-files' AND
        (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid()::text = split_part(name, '/', 1))
    );
