import fs from 'fs';

// 1. Load env
const text = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of text.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const eqIdx = trimmed.indexOf('=');
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}
const apiKey = env.EMBEDDING_API_KEY;
console.log(`EMBEDDING_API_KEY_PRESENT=${!!apiKey}`);
console.log(`EMBEDDING_API_KEY_LENGTH=${apiKey ? apiKey.length : 0}`);

if (!apiKey) process.exit(1);

// 2. Test Gemini API
const GEMINI_MODEL = 'gemini-embedding-001';
const VECTOR_DIM = 768;

async function testGemini() {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent?key=${apiKey}`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${GEMINI_MODEL}`,
        content: { parts: [{ text: "MemorySpace embedding test" }] },
        outputDimensionality: VECTOR_DIM,
      }),
    });
    
    const data = await response.json();
    console.log(`HTTP_STATUS=${response.status}`);
    
    if (!response.ok || data.error) {
      console.log(`GEMINI_TEST_SUCCESS=false`);
      console.log(`GEMINI_ERROR_STATUS=${response.status}`);
      console.log(`GEMINI_ERROR_CODE=${data.error?.code || 'N/A'}`);
      console.log(`GEMINI_ERROR_MESSAGE=${data.error?.message || response.statusText}`);
      return;
    }
    
    const values = data.embedding?.values;
    console.log(`GEMINI_TEST_SUCCESS=true`);
    console.log(`IS_ARRAY=${Array.isArray(values)}`);
    console.log(`VECTOR_DIMENSION=${values ? values.length : 0}`);
    if (values && Array.isArray(values)) {
      const allFinite = values.every(v => Number.isFinite(v));
      console.log(`ALL_FINITE=${allFinite}`);
    }
  } catch (err) {
    console.log(`GEMINI_TEST_SUCCESS=false`);
    console.log(`GEMINI_ERROR_MESSAGE=${err.message}`);
  }
}

testGemini();
