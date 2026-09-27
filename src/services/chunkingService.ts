import { supabase } from '../lib/supabase';
import type { DocumentContent, DocumentChunk, DocumentChunkInsert } from '../types/document';

// ── Default Chunking Configuration ───────────────────────────────────────────

export interface ChunkingOptions {
  targetChunkSize?: number; // Target characters per chunk (~800-1200, default: 1000)
  overlap?: number;         // Overlap characters (~150-200, default: 180)
}

export const DEFAULT_CHUNKING_OPTIONS: Required<ChunkingOptions> = {
  targetChunkSize: 1000,
  overlap: 180,
};

// ── Intermediate Parsed Section ──────────────────────────────────────────────

interface DocumentSection {
  text: string;
  page_number: number | null;
  slide_number: number | null;
}

export interface GeneratedChunk {
  content: string;
  character_count: number;
  word_count: number;
  page_number: number | null;
  slide_number: number | null;
}

// ── Text Normalization ───────────────────────────────────────────────────────

/**
 * Normalizes extracted text:
 * - Converts CRLF to LF
 * - Trims trailing whitespace on each line
 * - Collapses 3+ consecutive newlines to 2 (standard paragraph break)
 * - Trims overall text
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+$/gm, '') // trim trailing line spaces
    .replace(/\n{3,}/g, '\n\n') // collapse excessive blank lines
    .trim();
}

// ── Section Parser (Extracts Page / Slide Metadata) ──────────────────────────

/**
 * Detects whether the extracted text contains structured page or slide headers
 * from Phase 5A (e.g. "Page 1:\n..." or "Slide 1:\n...") and splits them into sections.
 * If no headers exist, treats the entire document as a single unsectioned unit.
 */
export function parseSections(extractedText: string): DocumentSection[] {
  const normalized = normalizeText(extractedText);
  if (!normalized) return [];

  // Match headers like "Page 1:" or "Slide 1:" at the start of a block
  const sectionHeaderRegex = /^(?:--- )?(Page|Slide)\s+(\d+)(?:\s*---)?:\s*$/im;

  const lines = normalized.split('\n');
  const sections: DocumentSection[] = [];

  let currentType: 'Page' | 'Slide' | null = null;
  let currentNum: number | null = null;
  let currentLines: string[] = [];

  let hasHeaders = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(sectionHeaderRegex);

    if (match) {
      hasHeaders = true;
      // If we already accumulated lines for a previous section, push it
      if (currentLines.length > 0) {
        const bodyText = currentLines.join('\n').trim();
        if (bodyText) {
          sections.push({
            text: bodyText,
            page_number: currentType === 'Page' ? currentNum : null,
            slide_number: currentType === 'Slide' ? currentNum : null,
          });
        }
        currentLines = [];
      }

      currentType = match[1].toLowerCase() === 'page' ? 'Page' : 'Slide';
      currentNum = parseInt(match[2], 10);
    } else {
      currentLines.push(line);
    }
  }

  // Push remaining lines
  if (currentLines.length > 0) {
    const bodyText = currentLines.join('\n').trim();
    if (bodyText) {
      sections.push({
        text: bodyText,
        page_number: currentType === 'Page' ? currentNum : null,
        slide_number: currentType === 'Slide' ? currentNum : null,
      });
    }
  }

  // If no Page/Slide headers were detected, return the whole text as a single section with null page/slide
  if (!hasHeaders || sections.length === 0) {
    return [
      {
        text: normalized,
        page_number: null,
        slide_number: null,
      },
    ];
  }

  return sections;
}

// ── Chunk Splitting Logic ────────────────────────────────────────────────────

/**
 * Finds the best split point near `desiredEnd` respecting the priority:
 * 1. Paragraph boundary (`\n\n`)
 * 2. Line boundary (`\n`)
 * 3. Sentence boundary (`. `, `! `, `? `)
 * 4. Whitespace (` `)
 * 5. Hard boundary fallback
 */
function findNaturalSplitPoint(text: string, start: number, desiredEnd: number): number {
  if (desiredEnd >= text.length) {
    return text.length;
  }

  // Search window around desiredEnd (e.g. up to 200 chars before and 150 chars after)
  const windowStart = Math.max(start + 400, desiredEnd - 200);
  const windowEnd = Math.min(text.length, desiredEnd + 150);
  const windowText = text.slice(windowStart, windowEnd);

  // 1. Check for paragraph boundary (\n\n)
  let bestPos = -1;
  let searchIndex = 0;
  while ((searchIndex = windowText.indexOf('\n\n', searchIndex)) !== -1) {
    const absPos = windowStart + searchIndex + 2;
    if (absPos > start) {
      if (bestPos === -1 || Math.abs(absPos - desiredEnd) < Math.abs(bestPos - desiredEnd)) {
        bestPos = absPos;
      }
    }
    searchIndex += 2;
  }
  if (bestPos !== -1) return bestPos;

  // 2. Check for single newline (\n)
  searchIndex = 0;
  while ((searchIndex = windowText.indexOf('\n', searchIndex)) !== -1) {
    const absPos = windowStart + searchIndex + 1;
    if (absPos > start) {
      if (bestPos === -1 || Math.abs(absPos - desiredEnd) < Math.abs(bestPos - desiredEnd)) {
        bestPos = absPos;
      }
    }
    searchIndex += 1;
  }
  if (bestPos !== -1) return bestPos;

  // 3. Check for sentence boundaries (. , ! , ? followed by space or newline)
  const sentenceRegex = /[.!?][\s\n]+/g;
  let match: RegExpExecArray | null;
  while ((match = sentenceRegex.exec(windowText)) !== null) {
    const absPos = windowStart + match.index + match[0].length;
    if (absPos > start) {
      if (bestPos === -1 || Math.abs(absPos - desiredEnd) < Math.abs(bestPos - desiredEnd)) {
        bestPos = absPos;
      }
    }
  }
  if (bestPos !== -1) return bestPos;

  // 4. Check for whitespace boundary
  searchIndex = 0;
  while ((searchIndex = windowText.indexOf(' ', searchIndex)) !== -1) {
    const absPos = windowStart + searchIndex + 1;
    if (absPos > start) {
      if (bestPos === -1 || Math.abs(absPos - desiredEnd) < Math.abs(bestPos - desiredEnd)) {
        bestPos = absPos;
      }
    }
    searchIndex += 1;
  }
  if (bestPos !== -1) return bestPos;

  // 5. Fallback: hard boundary at desiredEnd
  return desiredEnd;
}

/**
 * Finds a suitable start point for the overlapping next chunk around `candidateStart`
 * to avoid starting in the middle of a word.
 */
function findOverlapStart(text: string, candidateStart: number, prevStart: number): number {
  if (candidateStart <= prevStart) {
    return prevStart + 1;
  }

  // Look for a space or newline nearby
  const searchStart = Math.max(prevStart + 1, candidateStart - 40);
  const searchEnd = Math.min(text.length, candidateStart + 40);
  const slice = text.slice(searchStart, searchEnd);

  const spaceIndex = slice.indexOf(' ');
  if (spaceIndex !== -1) {
    const adjusted = searchStart + spaceIndex + 1;
    if (adjusted > prevStart && adjusted < text.length) {
      return adjusted;
    }
  }

  const newlineIndex = slice.indexOf('\n');
  if (newlineIndex !== -1) {
    const adjusted = searchStart + newlineIndex + 1;
    if (adjusted > prevStart && adjusted < text.length) {
      return adjusted;
    }
  }

  return candidateStart;
}

/**
 * Chunks a single text string into overlapping chunks.
 * For text smaller than targetChunkSize, produces exactly 1 chunk.
 */
export function chunkSingleText(
  text: string,
  options: Required<ChunkingOptions>
): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  // Short document / section optimization: exactly 1 chunk
  if (normalized.length <= options.targetChunkSize) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;
  const len = normalized.length;

  while (start < len) {
    const desiredEnd = start + options.targetChunkSize;

    if (desiredEnd >= len) {
      const remaining = normalized.slice(start).trim();
      if (remaining.length > 0) {
        chunks.push(remaining);
      }
      break;
    }

    const splitPoint = findNaturalSplitPoint(normalized, start, desiredEnd);
    const chunkContent = normalized.slice(start, splitPoint).trim();

    if (chunkContent.length > 0) {
      chunks.push(chunkContent);
    }

    // Determine start of next chunk with overlap
    const candidateNextStart = Math.max(start + 1, splitPoint - options.overlap);
    const nextStart = findOverlapStart(normalized, candidateNextStart, start);

    if (nextStart <= start) {
      // Ensure strictly forward progress
      start = splitPoint;
    } else {
      start = nextStart;
    }

    // Guard against infinite loop
    if (start >= len) break;
  }

  return chunks;
}

// ── Main Deterministic Chunking Pipeline ─────────────────────────────────────

/**
 * Splits extracted document text into structured chunks preserving page/slide metadata.
 */
export function chunkDocumentText(
  extractedText: string,
  options: ChunkingOptions = {}
): GeneratedChunk[] {
  const opts: Required<ChunkingOptions> = {
    ...DEFAULT_CHUNKING_OPTIONS,
    ...options,
  };

  const sections = parseSections(extractedText);
  if (sections.length === 0) return [];

  const result: GeneratedChunk[] = [];

  for (const section of sections) {
    const sectionChunks = chunkSingleText(section.text, opts);

    for (const chunkText of sectionChunks) {
      const trimmed = chunkText.trim();
      if (!trimmed) continue;

      result.push({
        content: trimmed,
        character_count: trimmed.length,
        word_count: trimmed.split(/\s+/).filter(Boolean).length,
        page_number: section.page_number,
        slide_number: section.slide_number,
      });
    }
  }

  return result;
}

// ── Database Operations ──────────────────────────────────────────────────────

/**
 * Fetch all chunks for a document, ordered by chunk_index.
 * Includes embedding status fields (Phase 5C).
 */
export async function fetchDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
  const { data, error } = await supabase
    .from('document_chunks')
    .select(
      'id, document_id, document_content_id, user_id, chunk_index, content, character_count, word_count, page_number, slide_number, created_at'
    )
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true });

  if (error) {
    if (error.code === 'PGRST205' || error.message?.toLowerCase().includes('schema cache')) {
      console.warn(
        'Table "public.document_chunks" not found. Run supabase/phase5b_document_chunking.sql in the Supabase SQL Editor.'
      );
      return [];
    }
    console.error('Failed to fetch document chunks:', error);
    return [];
  }

  return (data || []) as DocumentChunk[];
}

/**
 * Fetch the chunk count for a document (efficient count query).
 */
export async function getDocumentChunkCount(documentId: string): Promise<number> {
  const { count, error } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

/**
 * Generates and stores chunks for a completed DocumentContent record.
 * 
 * Safety & Idempotency:
 * - Only runs when extraction_status === 'completed'.
 * - Safely removes any existing chunks for this document_content_id before inserting.
 * - Respects the unique(document_content_id, chunk_index) constraint.
 * - Does not delete or corrupt the original document if chunking fails.
 */
export async function generateAndStoreChunks(
  content: DocumentContent,
  options?: ChunkingOptions
): Promise<DocumentChunk[]> {
  if (content.extraction_status !== 'completed' || !content.extracted_text) {
    console.info(`Skipping chunking: document_content ${content.id} status is ${content.extraction_status}`);
    return [];
  }

  // 1. Generate text chunks deterministically
  const generated = chunkDocumentText(content.extracted_text, options);
  if (generated.length === 0) {
    console.info(`No chunks generated for document_content ${content.id}`);
    return [];
  }

  // 2. Prepare database payload
  const chunkRows: DocumentChunkInsert[] = generated.map((chunk, index) => ({
    document_id: content.document_id,
    document_content_id: content.id,
    user_id: content.user_id,
    chunk_index: index,
    content: chunk.content,
    character_count: chunk.character_count,
    word_count: chunk.word_count,
    page_number: chunk.page_number,
    slide_number: chunk.slide_number,
  }));

  // 3. Remove any previous chunks for this document_content to prevent duplicates (Idempotent)
  try {
    const { error: deleteError } = await supabase
      .from('document_chunks')
      .delete()
      .eq('document_content_id', content.id);

    if (deleteError && deleteError.code !== 'PGRST205') {
      console.warn('Warning removing prior chunks for idempotency:', deleteError);
    }
  } catch (cleanErr) {
    console.warn('Chunk cleanup error (continuing):', cleanErr);
  }

  // 4. Batch insert new chunks
  const { data, error: insertError } = await supabase
    .from('document_chunks')
    .insert(chunkRows)
    .select();

  if (insertError) {
    if (insertError.code === 'PGRST205' || insertError.message?.toLowerCase().includes('schema cache')) {
      console.warn(
        'Table "public.document_chunks" not found in Supabase. Run supabase/phase5b_document_chunking.sql in the Supabase SQL Editor.'
      );
    } else {
      console.error('Failed to insert document chunks into Supabase:', insertError);
    }
    // Return generated items as fallback for in-memory view without crashing
    return chunkRows.map((r, i) => ({
      id: `local-${i}`,
      ...r,
      page_number: r.page_number ?? null,
      slide_number: r.slide_number ?? null,
      created_at: new Date().toISOString(),
    }));
  }

  return (data || []) as DocumentChunk[];
}
