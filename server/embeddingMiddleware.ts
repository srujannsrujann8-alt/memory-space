import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import { getGeminiEmbedding, GEMINI_EMBEDDING_MODEL, GEMINI_VECTOR_DIMENSION } from './geminiEmbedding.ts';
import { enforceRateLimit } from './rateLimiter.ts';
import { logger } from './logger.ts';
import { isValidUUID } from './validation.ts';

// Process chunks in batches to avoid timeouts and rate-limit spikes
const BATCH_SIZE = 10;
// Delay between individual Gemini API calls (ms)
const INTER_CALL_DELAY_MS = 80;
const MAX_BODY_BYTES = 100 * 1024;

interface EmbedRequestBody {
  documentId?: string;
  chunkIds?: string[];
  forceRetry?: boolean;
}

interface ChunkRow {
  id: string;
  chunk_index: number;
  content: string;
  user_id: string;
  document_id: string;
}

export function createEmbeddingMiddleware(envConfig?: Record<string, string>) {
  return async function embeddingMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ) {
    const url = req.url || '';
    if (!url.startsWith('/api/embed-chunks')) {
      return next();
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
      return;
    }

    // ── 1. Resolve server-side API Key ────────────────────────────────────────
    const apiKey =
      process.env.EMBEDDING_API_KEY ||
      process.env.GEMINI_API_KEY ||
      envConfig?.EMBEDDING_API_KEY ||
      envConfig?.GEMINI_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      logger.error('[embed-chunks] EMBEDDING_API_KEY / GEMINI_API_KEY is not set in .env.local');
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error:
            'Embedding provider API key is not configured. Set EMBEDDING_API_KEY in .env.local and restart the dev server.',
          status: 'missing_api_key',
        })
      );
      return;
    }

    // ── 2. Validate user Bearer token ─────────────────────────────────────────
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing authentication token.' }));
      return;
    }

    const supabaseUrl =
      process.env.VITE_SUPABASE_URL ||
      envConfig?.VITE_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      envConfig?.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Supabase not configured' }));
      return;
    }


    // Build a Supabase client scoped to the authenticated user's session.
    // This enforces RLS: users can only read/update their own chunks.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.error('[embed-chunks] Auth validation failed:', authError?.message);
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid or expired session token.' }));
      return;
    }

    // ── Rate Limiting (Phase 9B.4) ────────────────────────────────────────────
    if (!enforceRateLimit(res, user.id, 'chunk embeddings generation')) {
      return;
    }

    logger.info(`[embed-chunks] Authenticated user: ${user.id}`);

    // ── 3. Read request body ──────────────────────────────────────────────────
    let bodyText = '';
    let isTooLarge = false;

    req.on('data', (chunk) => {
      bodyText += chunk;
      if (bodyText.length > MAX_BODY_BYTES) {
        isTooLarge = true;
      }
    });

    req.on('end', async () => {
      if (isTooLarge) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Request body exceeds maximum size (100KB).' }));
        return;
      }

      try {
        let parsed: EmbedRequestBody = {};
        if (bodyText.trim()) {
          try {
            parsed = JSON.parse(bodyText);
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid JSON in request body.' }));
            return;
          }
        }

        const { documentId, chunkIds, forceRetry = false } = parsed;

        if (documentId && !isValidUUID(documentId)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid documentId: must be a valid UUID.' }));
          return;
        }

        if (chunkIds && (!Array.isArray(chunkIds) || chunkIds.some((id) => !isValidUUID(id)))) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid chunkIds: all elements must be valid UUIDs.' }));
          return;
        }

        logger.info(
          `[embed-chunks] Request — documentId: ${documentId ?? 'all'}, forceRetry: ${forceRetry}, chunkIds: ${chunkIds?.length ?? 'none'}`
        );

        // ── 4. Fetch pending chunks (belonging to this user) ──────────────────
        let query = supabase
          .from('document_chunks')
          .select('id, chunk_index, content, user_id, document_id')
          .eq('user_id', user.id);

        if (documentId) {
          query = query.eq('document_id', documentId);
        }

        if (chunkIds && chunkIds.length > 0) {
          query = query.in('id', chunkIds);
        }

        if (!forceRetry) {
          // Skip chunks that already have a stored vector
          query = query.is('embedding', null);
        } else {
          // Re-embed everything
          // (Since we don't have status columns, forceRetry just re-processes everything for the doc)
        }

        query = query.order('chunk_index', { ascending: true });

        const { data: chunks, error: fetchError } = await query;

        if (fetchError) {
          console.error('[embed-chunks] Failed to fetch chunks from Supabase:', fetchError);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Database error fetching chunks: ${fetchError.message}` }));
          return;
        }

        if (!chunks || chunks.length === 0) {
          console.log('[embed-chunks] No pending chunks found — all embeddings already complete.');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: true,
              total: 0,
              embedded: 0,
              failed: 0,
              message: 'No chunks require embeddings at this time.',
            })
          );
          return;
        }

        console.log(`[embed-chunks] Found ${chunks.length} chunks to embed using model: ${GEMINI_EMBEDDING_MODEL} (${GEMINI_VECTOR_DIMENSION}d)`);

        // ── 5. Process Chunks ────────────────────────────────────────────────
        // (embedding_status column does not exist in DB — skipping status updates)

        // ── 6. Process in batches ─────────────────────────────────────────────
        let successCount = 0;
        let failCount = 0;
        const errors: Array<{ chunk_index: number; error: string }> = [];

        for (let batchStart = 0; batchStart < (chunks as ChunkRow[]).length; batchStart += BATCH_SIZE) {
          const batch = (chunks as ChunkRow[]).slice(batchStart, batchStart + BATCH_SIZE);
          console.log(
            `[embed-chunks] Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1} ` +
            `(chunks ${batchStart}–${batchStart + batch.length - 1} of ${(chunks as ChunkRow[]).length})`
          );

          for (const chunk of batch) {
            const content = chunk.content?.trim();
            if (!content) {
              console.warn(`[embed-chunks] Chunk ${chunk.chunk_index} (id: ${chunk.id}) has empty content — skipping.`);
              continue;
            }

            try {
              // Call Gemini API — server-side only (key never leaves this process)
              const values = await getGeminiEmbedding(content, apiKey);

              // pgvector accepts the '[v1,v2,...]' string format
              const vectorString = `[${values.join(',')}]`;

              const { error: updateError } = await supabase
                .from('document_chunks')
                .update({
                  embedding: vectorString
                })
                .eq('id', chunk.id)
                .eq('user_id', user.id);

              if (updateError) {
                throw updateError;
              }

              console.log(`[embed-chunks] ✓ Chunk ${chunk.chunk_index} embedded (${values.length}d)`);
              successCount++;

              // Polite delay between Gemini API calls to respect rate limits
              await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS));
            } catch (chunkErr: unknown) {
              const rawMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
              // Sanitize: never persist or return the API key in error messages
              const safeMsg = rawMsg.replace(/key=[^&\s"]+/gi, 'key=[REDACTED]');
              console.error(`[embed-chunks] ✗ Chunk ${chunk.chunk_index} failed:`, safeMsg);

              // (Skipping saving error status to DB because embedding_error column doesn't exist)
              failCount++;
              errors.push({ chunk_index: chunk.chunk_index, error: safeMsg });
            }
          }
        }

        console.log(
          `[embed-chunks] Finished — success: ${successCount}, failed: ${failCount}, total: ${(chunks as ChunkRow[]).length}`
        );

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            success: successCount > 0,
            total: (chunks as ChunkRow[]).length,
            embedded: successCount,
            failed: failCount,
            errors: errors.length > 0 ? errors : undefined,
          })
        );
      } catch (err: unknown) {
        const rawMsg = err instanceof Error ? err.message : String(err);
        console.error('[embed-chunks] Uncaught middleware error:', rawMsg);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal server error during embedding generation.' }));
      }
    });
  };
}
