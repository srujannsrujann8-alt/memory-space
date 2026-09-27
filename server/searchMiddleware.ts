import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import { getGeminiEmbedding, GEMINI_EMBEDDING_MODEL, GEMINI_VECTOR_DIMENSION } from './geminiEmbedding.ts';
import { enforceRateLimit } from './rateLimiter.ts';
import { logger } from './logger.ts';
import { sanitizeString, parseBoundedInt } from './validation.ts';

// Maximum number of results to return (abuse prevention)
const MAX_RESULTS = 20;
const DEFAULT_RESULTS = 5;
const MAX_QUERY_LENGTH = 1000;
const MAX_BODY_BYTES = 100 * 1024; // 100 KB limit

export interface SearchResultRow {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
  filename: string;
  category: string;
  file_type: string;
}

export interface SearchResponse {
  success: boolean;
  results?: SearchResultRow[];
  query?: string;
  model?: string;
  error?: string;
  status?: string;
}

export function createSearchMiddleware(envConfig?: Record<string, string>) {
  return async function searchMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ) {
    const url = req.url || '';
    if (!url.startsWith('/api/search')) {
      return next();
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Method Not Allowed. Use POST.' }));
      return;
    }

    // ── 1. Resolve API Key ────────────────────────────────────────────────────
    const apiKey =
      process.env.EMBEDDING_API_KEY ||
      process.env.GEMINI_API_KEY ||
      envConfig?.EMBEDDING_API_KEY ||
      envConfig?.GEMINI_API_KEY;

    if (!apiKey?.trim()) {
      logger.error('[search] EMBEDDING_API_KEY is not configured.');
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: 'Search provider not configured. Set EMBEDDING_API_KEY in .env.local.',
        status: 'missing_api_key',
      }));
      return;
    }

    // ── 2. Validate Bearer token ──────────────────────────────────────────────
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Missing authentication token.' }));
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


    // RLS-scoped Supabase client: all queries run as the authenticated user
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    // Verify the token is valid
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid or expired session token.' }));
      return;
    }

    // ── Rate Limiting (Phase 9B.4) ────────────────────────────────────────────
    if (!enforceRateLimit(res, user.id, 'semantic search')) {
      return;
    }

    logger.info(`[search] Authenticated user: ${user.id}`);

    // ── 3. Parse request body ─────────────────────────────────────────────────
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
        res.end(JSON.stringify({ success: false, error: 'Request body exceeds maximum size (100KB).' }));
        return;
      }

      try {
        let parsed: { query?: string; limit?: number } = {};
        if (bodyText.trim()) {
          try {
            parsed = JSON.parse(bodyText);
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON in request body.' }));
            return;
          }
        }

        const rawQuery = sanitizeString(parsed.query, MAX_QUERY_LENGTH, 1);
        if (!rawQuery) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: `Query must be a non-empty string under ${MAX_QUERY_LENGTH} characters.`
          }));
          return;
        }

        const limit = parseBoundedInt(parsed.limit, 1, MAX_RESULTS, DEFAULT_RESULTS);

        logger.info(`[search] Query: "${logger.truncate(rawQuery, 80)}", limit: ${limit}`);

        // ── 4. Generate query embedding (server-side, key never leaves process) ──
        let queryVector: number[];
        try {
          queryVector = await getGeminiEmbedding(rawQuery, apiKey);
        } catch (geminiErr: unknown) {
          const rawMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
          logger.error('[search] Gemini embedding failed:', rawMsg);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Embedding generation failed temporarily. Please try again.' }));
          return;
        }

        // ── 5. Validate the returned vector ──────────────────────────────────
        if (!Array.isArray(queryVector) || queryVector.length !== GEMINI_VECTOR_DIMENSION) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            error: `Invalid vector: expected ${GEMINI_VECTOR_DIMENSION} dimensions, got ${queryVector?.length ?? 0}.`,
          }));
          return;
        }
        const allFinite = queryVector.every(v => Number.isFinite(v));
        if (!allFinite) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Invalid vector: contains non-finite values.' }));
          return;
        }

        console.log(`[search] Query vector validated: ${GEMINI_VECTOR_DIMENSION}d, all finite`);

        // ── 6. Call Supabase RPC (search_document_chunks) ─────────────────────
        // The RPC function is SECURITY INVOKER and uses auth.uid() internally.
        // The supabase client is scoped to the user's session, so RLS applies.
        let { data: results, error: rpcError } = await supabase.rpc(
          'search_document_chunks',
          {
            query_embedding: queryVector,
            match_count: limit,
            similarity_floor: 0.0,
          }
        );

        // PostgREST fallback: if array serialization wasn't matched, try string format
        if (rpcError && (rpcError.code === 'PGRST202' || rpcError.message?.includes('schema cache'))) {
          const fallback = await supabase.rpc('search_document_chunks', {
            query_embedding: `[${queryVector.join(',')}]`,
            match_count: limit,
            similarity_floor: 0.0,
          });
          if (!fallback.error) {
            results = fallback.data;
            rpcError = null;
          }
        }

        if (rpcError) {
          const safeRpcMsg = rpcError.message || 'Unknown RPC error';
          console.error('[search] Supabase RPC error:', safeRpcMsg);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: `Database search failed: ${safeRpcMsg}` }));
          return;
        }

        const typedResults = (results || []) as SearchResultRow[];
        console.log(`[search] Returned ${typedResults.length} result(s) for user ${user.id}`);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          query: rawQuery,
          model: GEMINI_EMBEDDING_MODEL,
          results: typedResults,
        }));

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Internal server error';
        console.error('[search] Unhandled error:', msg);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: msg }));
      }
    });
  };
}
