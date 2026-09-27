import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnswerSource {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  filename: string;
  category: string;
  file_type: string;
  similarity: number;
  content: string;
}

export interface AnswerResult {
  success: boolean;
  query: string;
  answer: string;
  sources: AnswerSource[];
  chunks_retrieved: number;
  embedding_model: string;
  generation_model: string;
}

// ── AI Answer ─────────────────────────────────────────────────────────────────

/**
 * Send a question to the Phase 7 RAG endpoint.
 *
 * Flow:
 *  Client → POST /api/answer (Bearer token)
 *  Server → embed query → pgvector retrieval → Gemini Flash → answer + sources
 *
 * @param query  The student's natural-language question
 */
export async function askQuestion(query: string): Promise<AnswerResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Question must be non-empty.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be logged in to use the AI assistant.');
  }

  const response = await fetch('/api/answer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ query: trimmed }),
  });

  const data = (await response.json()) as AnswerResult & { error?: string };

  if (!response.ok || !data.success) {
    throw new Error(data.error || `AI assistant failed with HTTP ${response.status}`);
  }

  return data;
}

