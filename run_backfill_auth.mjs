import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const token = fs.readFileSync('token.txt', 'utf8').trim();

// read .env.local
const envPath = '.env.local';
const text = fs.readFileSync(envPath, 'utf8');
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

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const apiKey = env.EMBEDDING_API_KEY || env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('ERROR: EMBEDDING_API_KEY is not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: { Authorization: `Bearer ${token}` }
  }
});

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
    throw new Error(data.error?.message || `HTTP ${response.status}`);
  }
  return data.embedding?.values;
}

async function main() {
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    console.error('Auth error:', authErr);
    process.exit(1);
  }
  
  console.log(`Authenticated as user ${user.id}`);

  const { data: chunks, error: fetchErr } = await supabase
    .from('document_chunks')
    .select('id, chunk_index, document_id, content')
    .eq('user_id', user.id)
    .is('embedding', null);

  if (fetchErr) {
    console.error('Fetch err:', fetchErr);
    return;
  }
  console.log(`Found ${chunks.length} chunks`);

  for (const chunk of chunks) {
    try {
      const values = await getEmbedding(chunk.content, apiKey);
      if (values.length !== VECTOR_DIM) {
        throw new Error(`Dimension mismatch: expected ${VECTOR_DIM}, got ${values.length}`);
      }
      
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
        .eq('id', chunk.id)
        .eq('user_id', user.id);
        
      if (updateErr) throw updateErr;
      console.log(`Embedded chunk ${chunk.id}`);
      
      await new Promise(r => setTimeout(r, 100));
    } catch(e) {
      console.error(`Error on ${chunk.id}:`, e.message);
    }
  }
}

main().catch(console.error);
