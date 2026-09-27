#!/usr/bin/env node
/**
 * Phase 5C Backfill Script
 * ========================
 * Generates embeddings for every row in public.document_chunks
 * where embedding IS NULL.
 *
 * Usage:
 *   node backfill-embeddings.mjs
 *
 * Prerequisites:
 *   1. npm run dev must NOT be running (or run this separately in another terminal)
 *   2. EMBEDDING_API_KEY must be set in .env.local
 *   3. Run from the project root directory
 *
 * This script uses the Supabase service-role key ONLY locally to backfill
 * existing chunks. It is safe to run multiple times — chunks with embeddings
 * are skipped automatically.
 *
 * After running, verify in Supabase SQL Editor:
 *   SELECT COUNT(*) AS total_chunks, COUNT(embedding) AS chunks_with_embeddings
 *   FROM public.document_chunks;
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────────────
async function loadEnv() {
  const envPath = join(__dirname, '.env.local');
  const text = await readFile(envPath, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

// ── Gemini Embedding ─────────────────────────────────────────────────────────
const GEMINI_MODEL = 'gemini-embedding-001';
const VECTOR_DIM = 768;

async function getEmbedding(text, apiKey) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${GEMINI_MODEL}`,
      content: { parts: [{ text: text.trim() }] },
      outputDimensionality: VECTOR_DIM,
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    const msg = data.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API error: ${msg}`);
  }

  const values = data.embedding?.values;
  if (!values || values.length !== VECTOR_DIM) {
    throw new Error(`Dimension mismatch: expected ${VECTOR_DIM}, got ${values?.length ?? 0}`);
  }
  return values;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('Phase 5C Backfill: Generating embeddings for all chunks');
  console.log('='.repeat(60));

  const env = await loadEnv();

  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const apiKey = env.EMBEDDING_API_KEY || env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY not set in .env.local');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('ERROR: EMBEDDING_API_KEY is not set in .env.local');
    console.error('Get your key at: https://aistudio.google.com/app/apikey');
    process.exit(1);
  }

  console.log(`Supabase URL : ${supabaseUrl}`);
  console.log(`Model        : ${GEMINI_MODEL} (${VECTOR_DIM}d)`);
  console.log(`API Key      : ${apiKey.slice(0, 8)}... (${apiKey.length} chars)`);
  console.log('');

  // NOTE: This script uses the anon key + reads ALL chunks.
  // In production you would use the service_role key for backfill only.
  // For local dev the anon key is fine as long as you're the only user.
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch all chunks with no embedding
  const { data: chunks, error: fetchErr } = await supabase
    .from('document_chunks')
    .select('id, chunk_index, document_id, content, user_id')
    .is('embedding', null)
    .order('document_id', { ascending: true })
    .order('chunk_index', { ascending: true });

  if (fetchErr) {
    console.error('Failed to fetch chunks:', fetchErr.message);
    process.exit(1);
  }

  if (!chunks || chunks.length === 0) {
    console.log('✓ No unembedded chunks found. All embeddings are already complete!');
    console.log('');
    console.log('Verification SQL:');
    console.log('  SELECT COUNT(*) AS total_chunks, COUNT(embedding) AS chunks_with_embeddings');
    console.log('  FROM public.document_chunks;');
    return;
  }

  console.log(`Found ${chunks.length} chunks to embed.\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prefix = `[${i + 1}/${chunks.length}] Chunk ${chunk.chunk_index} (doc: ${chunk.document_id.slice(0, 8)}...)`;

    try {
      const values = await getEmbedding(chunk.content, apiKey);
      const vectorString = `[${values.join(',')}]`;

      const { error: updateErr } = await supabase
        .from('document_chunks')
        .update({
          embedding: vectorString,
          embedding_model: GEMINI_MODEL,
          embedding_status: 'completed',
          embedding_error: null,
          embedded_at: new Date().toISOString(),
        })
        .eq('id', chunk.id);

      if (updateErr) {
        throw updateErr;
      }

      console.log(`${prefix} ✓ embedded`);
      success++;

      // Respect Gemini rate limits
      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      const safeMsg = err.message?.replace(/key=[^&\s"]+/gi, 'key=[REDACTED]') ?? 'Unknown error';
      console.error(`${prefix} ✗ FAILED: ${safeMsg}`);

      await supabase
        .from('document_chunks')
        .update({
          embedding_status: 'failed',
          embedding_error: safeMsg.slice(0, 500),
        })
        .eq('id', chunk.id);

      failed++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`DONE — Embedded: ${success} / ${chunks.length}  |  Failed: ${failed}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('Verify in Supabase SQL Editor:');
  console.log('  SELECT COUNT(*) AS total_chunks, COUNT(embedding) AS chunks_with_embeddings');
  console.log('  FROM public.document_chunks;');
}

main().catch((err) => {
  console.error('Backfill script crashed:', err);
  process.exit(1);
});
