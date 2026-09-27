-- ==============================================================================
-- MEMORYSPACE — PHASE 8 DATABASE SETUP: KNOWLEDGE INTELLIGENCE SYSTEM
-- Run this in the Supabase Dashboard: SQL Editor → New Query → Paste & Run
-- ==============================================================================

-- ── 1. CONVERSATIONS & CHAT MEMORY ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    grounded BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    chunk_id UUID REFERENCES public.document_chunks(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    chunk_index INT,
    similarity FLOAT,
    page_number INT,
    slide_number INT,
    content_snippet TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. AUTOMATIC TOPIC & CONCEPT EXTRACTION ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.knowledge_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_knowledge_topics_user_normalized UNIQUE (user_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS public.document_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES public.knowledge_topics(id) ON DELETE CASCADE,
    confidence FLOAT NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_document_topics_doc_topic UNIQUE (document_id, topic_id)
);

-- ── 3. KNOWLEDGE GAPS & STUDY INSIGHTS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.knowledge_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('well_covered', 'lightly_covered', 'gap', 'recommendation')),
    evidence TEXT NOT NULL,
    confidence FLOAT NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. PERFORMANCE INDEXES ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_convo_id ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_user_id ON public.conversation_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON public.conversation_messages(created_at ASC);

CREATE INDEX IF NOT EXISTS idx_message_sources_message_id ON public.message_sources(message_id);
CREATE INDEX IF NOT EXISTS idx_message_sources_user_id ON public.message_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_message_sources_document_id ON public.message_sources(document_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_topics_user_id ON public.knowledge_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_topics_normalized ON public.knowledge_topics(user_id, normalized_name);

CREATE INDEX IF NOT EXISTS idx_document_topics_document_id ON public.document_topics(document_id);
CREATE INDEX IF NOT EXISTS idx_document_topics_topic_id ON public.document_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_document_topics_user_id ON public.document_topics(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_insights_user_id ON public.knowledge_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_insights_type ON public.knowledge_insights(user_id, insight_type);

-- ── 5. ROW LEVEL SECURITY (RLS) POLICIES ─────────────────────────────────────

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_insights ENABLE ROW LEVEL SECURITY;

-- Conversations RLS
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON public.conversations;
CREATE POLICY "Users can insert own conversations" ON public.conversations
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations" ON public.conversations
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
CREATE POLICY "Users can delete own conversations" ON public.conversations
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Conversation Messages RLS
DROP POLICY IF EXISTS "Users can view own messages" ON public.conversation_messages;
CREATE POLICY "Users can view own messages" ON public.conversation_messages
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own messages" ON public.conversation_messages;
CREATE POLICY "Users can insert own messages" ON public.conversation_messages
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own messages" ON public.conversation_messages;
CREATE POLICY "Users can update own messages" ON public.conversation_messages
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.conversation_messages;
CREATE POLICY "Users can delete own messages" ON public.conversation_messages
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Message Sources RLS
DROP POLICY IF EXISTS "Users can view own message sources" ON public.message_sources;
CREATE POLICY "Users can view own message sources" ON public.message_sources
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own message sources" ON public.message_sources;
CREATE POLICY "Users can insert own message sources" ON public.message_sources
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own message sources" ON public.message_sources;
CREATE POLICY "Users can delete own message sources" ON public.message_sources
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Knowledge Topics RLS
DROP POLICY IF EXISTS "Users can view own topics" ON public.knowledge_topics;
CREATE POLICY "Users can view own topics" ON public.knowledge_topics
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own topics" ON public.knowledge_topics;
CREATE POLICY "Users can insert own topics" ON public.knowledge_topics
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own topics" ON public.knowledge_topics;
CREATE POLICY "Users can update own topics" ON public.knowledge_topics
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own topics" ON public.knowledge_topics;
CREATE POLICY "Users can delete own topics" ON public.knowledge_topics
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Document Topics RLS
DROP POLICY IF EXISTS "Users can view own document topics" ON public.document_topics;
CREATE POLICY "Users can view own document topics" ON public.document_topics
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own document topics" ON public.document_topics;
CREATE POLICY "Users can insert own document topics" ON public.document_topics
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own document topics" ON public.document_topics;
CREATE POLICY "Users can delete own document topics" ON public.document_topics
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Knowledge Insights RLS
DROP POLICY IF EXISTS "Users can view own insights" ON public.knowledge_insights;
CREATE POLICY "Users can view own insights" ON public.knowledge_insights
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own insights" ON public.knowledge_insights;
CREATE POLICY "Users can insert own insights" ON public.knowledge_insights
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own insights" ON public.knowledge_insights;
CREATE POLICY "Users can delete own insights" ON public.knowledge_insights
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── 6. GRANTS & RESTRICTIONS ─────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.message_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_topics TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.document_topics TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.knowledge_insights TO authenticated;

REVOKE ALL ON public.conversations FROM anon;
REVOKE ALL ON public.conversation_messages FROM anon;
REVOKE ALL ON public.message_sources FROM anon;
REVOKE ALL ON public.knowledge_topics FROM anon;
REVOKE ALL ON public.document_topics FROM anon;
REVOKE ALL ON public.knowledge_insights FROM anon;
