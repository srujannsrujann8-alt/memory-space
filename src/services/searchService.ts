import { supabase } from '../lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SemanticSearchResult {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
  filename: string;
  category: string;
  file_type: string;
}

export interface SemanticSearchResponse {
  success: boolean;
  query: string;
  model: string;
  results: SemanticSearchResult[];
  error?: string;
}

// ── Semantic Search ──────────────────────────────────────────────────────────

/**
 * Performs a semantic search against the user's documents.
 *
 * Flow:
 * 1. Sends query + auth token to POST /api/search (server-side)
 * 2. Server generates the query embedding via Gemini (key never leaves server)
 * 3. Server calls search_document_chunks RPC in Supabase (user-scoped via RLS)
 * 4. Returns ranked chunk results ordered by cosine similarity
 *
 * @param query   The natural-language search query
 * @param limit   Maximum results to return (default 5, max 20)
 */
export async function semanticSearch(
  query: string,
  limit = 5
): Promise<SemanticSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Search query must be non-empty.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be logged in to perform a semantic search.');
  }

  const response = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ query: trimmed, limit }),
  });

  const data = (await response.json()) as SemanticSearchResponse;

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Search failed with HTTP ${response.status}`);
  }

  return data;
}
