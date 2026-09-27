import { supabase } from '../lib/supabase';
import type { EmbeddingStatus } from '../types/document';

export interface EmbeddingTriggerResult {
  success: boolean;
  total: number;
  embedded: number;
  failed: number;
  message?: string;
  error?: string;
}

export interface DocumentEmbeddingSummary {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  processing: number;
  status: EmbeddingStatus;
}

/**
 * Triggers the server-side embedding generation endpoint for a given document.
 * The server securely accesses EMBEDDING_API_KEY without exposing it to the client.
 */
export async function triggerDocumentEmbedding(
  documentId: string,
  forceRetry = false
): Promise<EmbeddingTriggerResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('User is not authenticated. Cannot generate embeddings.');
  }

  const response = await fetch('/api/embed-chunks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      documentId,
      forceRetry,
    }),
  });

  const result = (await response.json()) as EmbeddingTriggerResult;

  if (!response.ok) {
    const errorMsg = result.error || `HTTP ${response.status}: Failed to generate embeddings`;
    throw new Error(errorMsg);
  }

  return result;
}

/**
 * Triggers backfill of all pending embeddings for the authenticated user.
 * It does not filter by documentId.
 */
export async function triggerPendingEmbeddings(): Promise<EmbeddingTriggerResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('User is not authenticated. Cannot run embedding backfill.');
  }

  const response = await fetch('/api/embed-chunks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({}),
  });

  const result = (await response.json()) as EmbeddingTriggerResult;

  if (!response.ok) {
    const errorMsg = result.error || `HTTP ${response.status}: Failed to run backfill embeddings`;
    throw new Error(errorMsg);
  }

  if (result.failed > 0) {
    console.warn(`Backfill completed with ${result.failed} failures.`);
  }

  return result;
}

/**
 * Fetches the current embedding status summary for a document's chunks.
 * Uses the actual `embedding` vector column (IS NOT NULL) since
 * embedding_status is not in the real database schema.
 */
export async function fetchDocumentEmbeddingSummary(
  documentId: string
): Promise<DocumentEmbeddingSummary> {
  const { data: chunks, error } = await supabase
    .from('document_chunks')
    .select('id, embedding')
    .eq('document_id', documentId);

  if (error || !chunks) {
    return {
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      processing: 0,
      status: 'pending',
    };
  }

  const total = chunks.length;
  // A chunk is 'completed' if the embedding column is non-null
  const completed = chunks.filter((c) => c.embedding !== null && c.embedding !== undefined).length;
  const pending = total - completed;

  return {
    total,
    completed,
    failed: 0,
    pending,
    processing: 0,
    status: total > 0 && completed === total ? 'completed' : pending > 0 ? 'pending' : 'pending',
  };
}
