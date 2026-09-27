import { supabase } from '../lib/supabase';
import type { Document } from '../types/document';

export interface KnowledgeTopic {
  id: string;
  name: string;
  normalized_name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentTopic {
  id: string;
  document_id: string;
  topic_id: string;
  confidence: number;
  topic?: KnowledgeTopic;
}

// ── Trigger Server Topic Extraction ──────────────────────────────────────────

export async function extractTopicsForDocument(
  documentId: string
): Promise<Array<{ id: string; name: string }>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('User not authenticated');
  }

  const res = await fetch('/api/topics/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ document_id: documentId }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to extract topics');
  }

  return data.topics || [];
}

// ── Fetch All Topics for User ────────────────────────────────────────────────

export async function fetchKnowledgeTopics(userId?: string): Promise<KnowledgeTopic[]> {
  let query = supabase
    .from('knowledge_topics')
    .select('*')
    .order('name', { ascending: true });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching knowledge topics:', error);
    return [];
  }
  return data || [];
}

// ── Fetch Topics for a specific Document ─────────────────────────────────────

export async function fetchDocumentTopics(documentId: string): Promise<KnowledgeTopic[]> {
  const { data, error } = await supabase
    .from('document_topics')
    .select(`
      topic_id,
      knowledge_topics (
        id,
        name,
        normalized_name,
        description,
        created_at,
        updated_at
      )
    `)
    .eq('document_id', documentId);

  if (error || !data) {
    console.error('Error fetching document topics:', error);
    return [];
  }

  return data
    .map((d: any) => d.knowledge_topics)
    .filter(Boolean) as KnowledgeTopic[];
}

// ── Fetch Documents tagged with a Topic ──────────────────────────────────────

export async function fetchTopicDocuments(topicId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('document_topics')
    .select(`
      document_id,
      documents (*)
    `)
    .eq('topic_id', topicId);

  if (error || !data) {
    console.error('Error fetching topic documents:', error);
    return [];
  }

  return data
    .map((d: any) => d.documents)
    .filter(Boolean) as Document[];
}

// ── Fetch Related Documents (Phase 8E) ───────────────────────────────────────
// Identifies related documents via shared topics and shared category

export async function fetchRelatedDocuments(
  documentId: string
): Promise<Array<{ document: Document; reason: string }>> {
  // 1. Get this document's topics
  const topics = await fetchDocumentTopics(documentId);
  const topicIds = topics.map((t) => t.id);

  if (topicIds.length === 0) {
    return [];
  }

  // 2. Find other documents that share these topics
  const { data, error } = await supabase
    .from('document_topics')
    .select(`
      document_id,
      topic_id,
      documents (*),
      knowledge_topics (name)
    `)
    .in('topic_id', topicIds)
    .neq('document_id', documentId);

  if (error || !data) {
    return [];
  }

  const docMap = new Map<string, { document: Document; sharedTopics: string[] }>();

  data.forEach((row: any) => {
    if (!row.documents) return;
    const doc = row.documents as Document;
    const topicName = row.knowledge_topics?.name || 'Topic';

    if (!docMap.has(doc.id)) {
      docMap.set(doc.id, { document: doc, sharedTopics: [] });
    }
    docMap.get(doc.id)!.sharedTopics.push(topicName);
  });

  return Array.from(docMap.values()).map(({ document, sharedTopics }) => ({
    document,
    reason: `Related because both documents discuss ${sharedTopics.slice(0, 3).join(', ')}.`,
  }));
}
