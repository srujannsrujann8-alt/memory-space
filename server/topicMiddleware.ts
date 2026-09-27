/**
 * Phase 8C/8F — Topic Extraction & Knowledge Insights Middleware
 *
 * Endpoints:
 *   POST /api/topics/extract  — Extract real concepts from document content
 *   POST /api/insights/analyze — Generate study coverage insights & gaps
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import {
  generateJson,
  PRIMARY_GENERATION_MODEL,
} from './geminiGeneration.ts';
import { enforceRateLimit } from './rateLimiter.ts';
import { logger } from './logger.ts';
import { isValidUUID, sanitizeString } from './validation.ts';

const GEMINI_GENERATION_MODEL = PRIMARY_GENERATION_MODEL;
const MAX_BODY_BYTES = 100 * 1024;
const MAX_GOAL_LENGTH = 500;

// ── Generation delegated to geminiGeneration.ts ──────────────────────────────
// callGeminiJson is now replaced by generateJson() from the shared helper

export function createTopicMiddleware(envConfig?: Record<string, string>) {
  return async function topicMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ) {
    const url = req.url || '';
    if (!url.startsWith('/api/topics') && !url.startsWith('/api/insights')) {
      return next();
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
      return;
    }

    const apiKey =
      process.env.EMBEDDING_API_KEY ||
      process.env.GEMINI_API_KEY ||
      envConfig?.EMBEDDING_API_KEY ||
      envConfig?.GEMINI_API_KEY;

    if (!apiKey?.trim()) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'AI key not configured' }));
      return;
    }

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid session' }));
      return;
    }

    // ── Rate Limiting (Phase 9B.4) ────────────────────────────────────────────
    const actionLabel = url.startsWith('/api/topics') ? 'topic extraction' : 'insights analysis';
    if (!enforceRateLimit(res, user.id, actionLabel)) {
      return;
    }

    let bodyText = '';
    let isTooLarge = false;

    req.on('data', (c) => {
      bodyText += c;
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
        let parsed: Record<string, any> = {};
        if (bodyText.trim()) {
          try {
            parsed = JSON.parse(bodyText);
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            return;
          }
        }

        // ── ROUTE 1: /api/topics/extract ──────────────────────────────────────
        if (url.startsWith('/api/topics/extract')) {
          const documentId = parsed.document_id;
          if (!documentId || !isValidUUID(documentId)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Invalid or missing document_id (must be a valid UUID)' }));
            return;
          }

          // Fetch document and its chunks
          const { data: doc, error: docErr } = await supabase
            .from('documents')
            .select('id, user_id, filename, category')
            .eq('id', documentId)
            .single();

          if (docErr || !doc || doc.user_id !== user.id) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Document not found' }));
            return;
          }

          // Fetch sample text from document_chunks (limit 6 chunks to avoid huge tokens)
          const { data: chunks } = await supabase
            .from('document_chunks')
            .select('content')
            .eq('document_id', documentId)
            .order('chunk_index', { ascending: true })
            .limit(6);

          const sampleText = (chunks || []).map((c) => c.content).join('\n\n').slice(0, 4000);

          if (!sampleText.trim()) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, topics: [], message: 'No content to extract' }));
            return;
          }

          const prompt = `You are a factual academic concept extractor.
Analyze the following study material text from "${doc.filename}".
Extract between 3 and 7 core topics/concepts explicitly discussed in this document.

STRICT RULES:
1. ONLY extract concepts explicitly supported by the text.
2. Do NOT invent facts or concepts.
3. Keep technical terminology intact.
4. Output a JSON array of objects with keys:
   - "name": string (standard title capitalization, e.g. "Semantic HTML", "CSS Grid", "Process Scheduling")
   - "description": string (one concise sentence describing the concept based strictly on the text)
   - "confidence": number (between 0.8 and 1.0)

DOCUMENT TEXT:
${sampleText}

JSON OUTPUT:`;

          const rawJson = await generateJson(prompt, apiKey, GEMINI_GENERATION_MODEL);
          let extracted: Array<{ name: string; description: string; confidence: number }> = [];
          try {
            const p = JSON.parse(rawJson);
            extracted = Array.isArray(p) ? p : (p.topics || p.concepts || []);
          } catch {
            extracted = [];
          }

          const savedTopics: Array<{ id: string; name: string }> = [];

          for (const item of extracted) {
            if (!item.name?.trim()) continue;
            const cleanName = item.name.trim();
            const normalized = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!normalized) continue;

            // Upsert into knowledge_topics
            const { data: topicRec, error: tErr } = await supabase
              .from('knowledge_topics')
              .upsert(
                {
                  user_id: user.id,
                  name: cleanName,
                  normalized_name: normalized,
                  description: item.description?.trim() || null,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,normalized_name' }
              )
              .select('id, name')
              .single();

            if (!tErr && topicRec) {
              // Link document_topics
              await supabase
                .from('document_topics')
                .upsert(
                  {
                    user_id: user.id,
                    document_id: documentId,
                    topic_id: topicRec.id,
                    confidence: item.confidence || 0.9,
                  },
                  { onConflict: 'document_id,topic_id' }
                );

              savedTopics.push(topicRec);
            }
          }

          logger.info(`[topic] Extracted ${savedTopics.length} topics for doc ${documentId}`);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, topics: savedTopics }));
          return;
        }

        // ── ROUTE 2: /api/insights/analyze ────────────────────────────────────
        if (url.startsWith('/api/insights/analyze')) {
          const studyGoal = sanitizeString(parsed.study_goal, MAX_GOAL_LENGTH, 0) || 'General Knowledge Mastery';

          // Fetch all user topics
          const { data: topics } = await supabase
            .from('knowledge_topics')
            .select('id, name, description')
            .order('name');

          // Fetch user documents count
          const { data: docs } = await supabase
            .from('documents')
            .select('id, filename, category');

          const topicNames = (topics || []).map((t) => t.name);
          const docNames = (docs || []).map((d) => `${d.filename} (${d.category})`);

          if (topicNames.length === 0) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              insights: [],
              message: 'Upload documents first to generate study insights.',
            }));
            return;
          }

          const prompt = `You are a curriculum and study coverage analyst.
Analyze the student's current library content and compare it to their goal: "${studyGoal}".

STUDENT'S EXISTING TOPICS:
${topicNames.join(', ')}

STUDENT'S DOCUMENTS:
${docNames.join(', ')}

STRICT RULES:
1. Do NOT make judgments about the student's personal intelligence or comprehension.
2. Describe observations purely in terms of document library coverage (e.g. "Your current library contains strong material on X, but limited material on Y").
3. Generate a JSON array of 3 to 6 insight objects with keys:
   - "topic": string (the topic name)
   - "insight_type": string (exactly one of: "well_covered", "lightly_covered", "gap", "recommendation")
   - "evidence": string (objective observation of library coverage)
   - "confidence": number (0.8 to 1.0)

JSON OUTPUT:`;

          const rawJson = await generateJson(prompt, apiKey, GEMINI_GENERATION_MODEL);
          logger.info('[insights] rawJson length:', rawJson.length);

          let insightsData: any[] = [];
          try {
            const p = JSON.parse(rawJson);
            if (Array.isArray(p)) {
              insightsData = p;
            } else if (p && typeof p === 'object') {
              insightsData = p.insights || p.topics || p.data || p.results || Object.values(p).find(Array.isArray) || [];
            }
          } catch (jsonErr) {
            logger.warn('[insights] Failed to parse JSON, attempting repair:', jsonErr);
            try {
              const lastClosingBrace = rawJson.lastIndexOf('}');
              if (lastClosingBrace > 0) {
                const repaired = rawJson.slice(0, lastClosingBrace + 1) + ']';
                const p = JSON.parse(repaired);
                if (Array.isArray(p)) {
                  insightsData = p;
                  logger.info('[insights] Successfully repaired truncated JSON response.');
                }
              }
            } catch {
              insightsData = [];
            }
          }

          // Clear previous insights for this user for fresh analysis
          await supabase.from('knowledge_insights').delete().eq('user_id', user.id);

          const normalizeType = (val?: string): string => {
            if (!val) return 'recommendation';
            const clean = String(val).toLowerCase().replace(/[-\s]/g, '_');
            if (clean.includes('well')) return 'well_covered';
            if (clean.includes('light')) return 'lightly_covered';
            if (clean.includes('gap')) return 'gap';
            return 'recommendation';
          };

          const rowsToInsert = insightsData
            .map((item: any) => {
              const topic = String(item.topic || item.name || item.concept || 'Web Development').trim();
              const rawType = item.insight_type || item.type || item.insightType;
              const insight_type = normalizeType(rawType);
              const evidence = String(item.evidence || item.description || item.reason || 'Curriculum coverage analyzed.').trim();
              const confidence = typeof item.confidence === 'number' ? Math.min(1.0, Math.max(0.5, item.confidence)) : 0.9;
              return {
                user_id: user.id,
                topic,
                insight_type,
                evidence,
                confidence,
              };
            })
            .filter((item) => item.topic.length > 0 && item.evidence.length > 0);

          if (rowsToInsert.length > 0) {
            await supabase.from('knowledge_insights').insert(rowsToInsert);
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, insights: rowsToInsert }));
          return;
        }

        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Server error';
        logger.error('[topic/insight] Error:', msg);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: msg }));
      }
    });
  };
}
