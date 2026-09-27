/**
 * Production Health Check Endpoint (Phase 9H.3)
 *
 * Endpoint: GET /api/health
 * Returns safe status information without exposing keys, credentials, or internal details.
 */

import type { IncomingMessage, ServerResponse } from 'http';

export function createHealthMiddleware(envConfig?: Record<string, string>) {
  return function healthMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ) {
    const url = req.url || '';
    if (url !== '/api/health' && url !== '/api/health/') {
      return next();
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
      return;
    }

    const hasApiKey = Boolean(
      (process.env.EMBEDDING_API_KEY ||
        process.env.GEMINI_API_KEY ||
        envConfig?.EMBEDDING_API_KEY ||
        envConfig?.GEMINI_API_KEY)?.trim()
    );

    const hasSupabaseUrl = Boolean(
      (process.env.VITE_SUPABASE_URL || envConfig?.VITE_SUPABASE_URL)?.trim()
    );

    const hasSupabaseKey = Boolean(
      (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envConfig?.VITE_SUPABASE_PUBLISHABLE_KEY)?.trim()
    );

    const status = {
      ok: true,
      timestamp: new Date().toISOString(),
      services: {
        supabase: hasSupabaseUrl && hasSupabaseKey ? 'ok' : 'misconfigured',
        embedding_service: hasApiKey ? 'configured' : 'unconfigured',
        generation_service: hasApiKey ? 'configured' : 'unconfigured',
      },
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.end(JSON.stringify(status, null, 2));
  };
}
