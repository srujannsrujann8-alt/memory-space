/**
 * Server-side Gemini Embedding Provider (Phase 5C)
 *
 * Model:     gemini-embedding-001  (replaces deprecated text-embedding-004)
 * Dimension: 768  (pinned via outputDimensionality — model default is 3072)
 * Endpoint:  https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent
 *
 * NEVER import this file directly into client-side bundles.
 */

export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
export const GEMINI_VECTOR_DIMENSION = 768; // must match vector(768) in document_chunks

interface GeminiEmbedResponse {
  embedding?: {
    values: number[];
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

interface GeminiBatchEmbedRequest {
  model: string;
  content: { parts: Array<{ text: string }> };
  outputDimensionality: number;
}

interface GeminiBatchEmbedResponse {
  embeddings?: Array<{
    values: number[];
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Generate a single 768-dimensional embedding using Google Gemini API.
 * Uses outputDimensionality: 768 to truncate from the model's default 3072 → 768,
 * matching the vector(768) column in public.document_chunks.
 */
export async function getGeminiEmbedding(text: string, apiKey: string): Promise<number[]> {
  const cleanText = text?.trim();
  if (!cleanText) {
    throw new Error('Cannot generate embedding for empty text content.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${GEMINI_EMBEDDING_MODEL}`,
      content: {
        parts: [{ text: cleanText }],
      },
      outputDimensionality: GEMINI_VECTOR_DIMENSION,
    }),
  });

  const data = (await response.json()) as GeminiEmbedResponse;

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || `HTTP ${response.status} ${response.statusText}`;
    const errorCode = data.error?.status || response.status;
    console.error(`[Gemini] embedContent failed — model: ${GEMINI_EMBEDDING_MODEL}, status: ${errorCode}, message: ${errorMsg}`);
    throw new Error(`Gemini Embedding API error (${errorCode}): ${errorMsg}`);
  }

  const values = data.embedding?.values;
  if (!values || !Array.isArray(values)) {
    throw new Error('Invalid Gemini embedding response: missing embedding.values array.');
  }

  if (values.length !== GEMINI_VECTOR_DIMENSION) {
    throw new Error(
      `Dimension mismatch: expected ${GEMINI_VECTOR_DIMENSION} dimensions, received ${values.length}. ` +
      `Check that outputDimensionality is accepted by the model version.`
    );
  }

  return values;
}

/**
 * Generate embedding vectors for a batch of texts using batchEmbedContents.
 * Falls back to sequential single calls on batch failure (e.g. rate-limit).
 * Each call pins outputDimensionality: 768.
 */
export async function getGeminiBatchEmbeddings(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const validTexts = texts.map((t) => t?.trim() || '');
  if (validTexts.length === 0) return [];

  // Single-item: use single embedContent
  if (validTexts.length === 1) {
    const single = await getGeminiEmbedding(validTexts[0], apiKey);
    return [single];
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;

  const requests: GeminiBatchEmbedRequest[] = validTexts.map((text) => ({
    model: `models/${GEMINI_EMBEDDING_MODEL}`,
    content: {
      parts: [{ text }],
    },
    outputDimensionality: GEMINI_VECTOR_DIMENSION,
  }));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });

  const data = (await response.json()) as GeminiBatchEmbedResponse;

  if (!response.ok || data.error) {
    // Batch failed — fall back to sequential single calls
    const errMsg = data.error?.message || response.statusText;
    console.warn(`[Gemini] batchEmbedContents failed (${response.status}): ${errMsg}. Falling back to sequential calls.`);
    const results: number[][] = [];
    for (const t of validTexts) {
      const res = await getGeminiEmbedding(t, apiKey);
      results.push(res);
      await new Promise((r) => setTimeout(r, 60));
    }
    return results;
  }

  const embeddings = data.embeddings;
  if (!embeddings || !Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new Error(`Invalid batch embedding response: expected ${texts.length} embeddings, received ${embeddings?.length ?? 0}.`);
  }

  return embeddings.map((e, i) => {
    if (!e.values || e.values.length !== GEMINI_VECTOR_DIMENSION) {
      throw new Error(`Batch item ${i}: dimension mismatch — expected ${GEMINI_VECTOR_DIMENSION}, got ${e.values?.length ?? 0}.`);
    }
    return e.values;
  });
}
