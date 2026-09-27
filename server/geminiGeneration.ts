/**
 * geminiGeneration.ts — Shared Gemini Text-Generation Helper
 *
 * Features:
 *  - Exponential backoff with jitter for transient 503 / UNAVAILABLE / 429 errors
 *  - Automatic fallback to secondary/tertiary models if primary exhausts all retries
 *  - Never retries permanent errors (INVALID_ARGUMENT, PERMISSION_DENIED, NOT_FOUND)
 *  - API key is NEVER logged or exposed
 *  - Embedding model (gemini-embedding-001) is never touched here
 */

// ── Model Configuration ───────────────────────────────────────────────────────

export const PRIMARY_GENERATION_MODEL =
  process.env.GEMINI_GENERATION_MODEL || 'gemini-3.8-flash';

export const FALLBACK_GENERATION_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.7-flash';

export const SECOND_FALLBACK_GENERATION_MODEL = 'gemini-3.6-flash';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ── Internal Types ────────────────────────────────────────────────────────────

interface GeminiGenResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { code: number; message: string; status: string };
}

export interface GenerationResult {
  text: string;
  model_used: string;
  fallback_notice?: string;
}

interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
}

// ── Error Classification ──────────────────────────────────────────────────────

function isTransientError(status: string | number, message: string): boolean {
  const s = String(status).toUpperCase();
  const m = String(message).toLowerCase();
  return (
    s === '503' || s === 'UNAVAILABLE' || s === '429' || s === 'RESOURCE_EXHAUSTED' ||
    m.includes('unavailable') || m.includes('high demand') || m.includes('capacity') ||
    m.includes('overloaded') || m.includes('try again') || m.includes('temporarily') ||
    m.includes('resource_exhausted') || m.includes('quota') || m.includes('rate') ||
    m.includes('exhausted') || m.includes('503') || m.includes('429')
  );
}

function isPermanentError(status: string | number): boolean {
  const s = String(status).toUpperCase();
  return (
    s === 'INVALID_ARGUMENT' || s === 'PERMISSION_DENIED' || s === 'NOT_FOUND' ||
    s === 'UNAUTHENTICATED' || s === '400' || s === '401' || s === '403' || s === '404'
  );
}

// ── Exponential Backoff with Jitter ───────────────────────────────────────────

function backoffMs(attempt: number, baseMs = 1000): number {
  const exponential = baseMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 400;
  return Math.min(exponential + jitter, 8000);
}

// ── Single Model Attempt (with internal retry) ────────────────────────────────

async function tryGenerateWithModel(
  prompt: string,
  apiKey: string,
  model: string,
  opts: GenerateOptions = {}
): Promise<string> {
  const { temperature = 0.3, maxOutputTokens = 1024, jsonMode = false } = opts;
  const endpoint = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    let data: GeminiGenResponse;

    try {
      const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          topP: 0.9,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      };

      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      data = (await response.json()) as GeminiGenResponse;
    } catch (netErr: unknown) {
      const msg = netErr instanceof Error ? netErr.message : String(netErr);
      if (attempt < MAX_ATTEMPTS) {
        const wait = backoffMs(attempt);
        console.warn(`[gemini-gen] Network error attempt ${attempt}/${MAX_ATTEMPTS} model=${model}: ${msg}. Retry in ${Math.round(wait)}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw new Error(`Gemini network error (${model}): ${msg}`);
    }

    if (!response.ok || data.error) {
      const status = data.error?.status ?? String(response.status);
      const msg = data.error?.message || `HTTP ${response.status}`;
      const safeMsg = msg.replace(/key=[^&\s"]+/gi, 'key=[REDACTED]');

      console.warn(`[gemini-gen] model=${model} attempt=${attempt}/${MAX_ATTEMPTS} status=${status}`);

      if (isPermanentError(status)) {
        throw new Error(`Gemini permanent error (${status}): ${safeMsg}`);
      }

      // If quota/resource is exhausted on this specific model, don't waste 3 attempts retrying it;
      // immediately let the outer fallback models take over!
      if (status === 'RESOURCE_EXHAUSTED' || safeMsg.toLowerCase().includes('quota')) {
        throw new Error(`Gemini generation failed (${status}): ${safeMsg}`);
      }

      if (isTransientError(status, msg) && attempt < MAX_ATTEMPTS) {
        const wait = backoffMs(attempt);
        console.warn(`[gemini-gen] Transient ${status} on ${model} — retrying in ${Math.round(wait)}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      throw new Error(`Gemini generation failed (${status}): ${safeMsg}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Gemini empty response for model ${model}.`);

    console.log(`[gemini-gen] OK model=${model} attempt=${attempt} chars=${text.length}`);
    return text.trim();
  }

  throw new Error(`Gemini exhausted ${MAX_ATTEMPTS} attempts for model ${model}.`);
}

// ── Public: Generate With Automatic Fallback ─────────────────────────────────

export async function generateWithFallback(
  prompt: string,
  apiKey: string,
  primaryModel: string = PRIMARY_GENERATION_MODEL,
  opts: GenerateOptions = {}
): Promise<GenerationResult> {
  const fallback1 = FALLBACK_GENERATION_MODEL;
  const fallback2 = SECOND_FALLBACK_GENERATION_MODEL;

  // Attempt primary
  try {
    console.log(`[gemini-gen] primary model=${primaryModel}`);
    const text = await tryGenerateWithModel(prompt, apiKey, primaryModel, opts);
    return { text, model_used: primaryModel };
  } catch (err1: unknown) {
    const msg1 = err1 instanceof Error ? err1.message : String(err1);
    const transient1 = isTransientError('', msg1);
    if (!transient1) throw new Error(`AI generation error: ${msg1}`);
    console.warn(`[gemini-gen] Primary ${primaryModel} failed (transient). Trying fallback ${fallback1}...`);
  }

  // Attempt fallback 1
  try {
    console.log(`[gemini-gen] fallback model=${fallback1}`);
    const text = await tryGenerateWithModel(prompt, apiKey, fallback1, opts);
    return {
      text,
      model_used: fallback1,
      fallback_notice: `Using an alternate AI model (${fallback1}) due to temporary service load.`,
    };
  } catch (err2: unknown) {
    const msg2 = err2 instanceof Error ? err2.message : String(err2);
    const transient2 = isTransientError('', msg2);
    if (!transient2) throw new Error(`AI generation error on fallback: ${msg2}`);
    console.warn(`[gemini-gen] Fallback ${fallback1} also failed. Trying second fallback ${fallback2}...`);
  }

  // Attempt fallback 2
  try {
    console.log(`[gemini-gen] second fallback model=${fallback2}`);
    const text = await tryGenerateWithModel(prompt, apiKey, fallback2, opts);
    return {
      text,
      model_used: fallback2,
      fallback_notice: `Using an alternate AI model (${fallback2}) due to temporary service load.`,
    };
  } catch (err3: unknown) {
    const msg3 = err3 instanceof Error ? err3.message : String(err3);
    console.error(`[gemini-gen] All generation models exhausted. Last error: ${msg3}`);
    throw new Error('AI generation is temporarily unavailable. Please try again in a moment.');
  }
}

export async function generateText(
  prompt: string,
  apiKey: string,
  model: string = PRIMARY_GENERATION_MODEL,
  temperature = 0.3
): Promise<string> {
  const result = await generateWithFallback(prompt, apiKey, model, { temperature });
  if (result.fallback_notice) console.log(`[gemini-gen] NOTICE: ${result.fallback_notice}`);
  return result.text;
}

export async function generateJson(
  prompt: string,
  apiKey: string,
  model: string = PRIMARY_GENERATION_MODEL,
  maxOutputTokens = 2048
): Promise<string> {
  const result = await generateWithFallback(prompt, apiKey, model, {
    temperature: 0.2,
    maxOutputTokens,
    jsonMode: true,
  });
  if (result.fallback_notice) console.log(`[gemini-gen] NOTICE: ${result.fallback_notice}`);
  // Strip markdown code fences if present (e.g. ```json ... ```)
  const clean = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return clean;
}

