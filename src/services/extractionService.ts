import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import { BUCKET_NAME } from './documentService';
import type { Document, DocumentContent, ExtractionStatus } from '../types/document';
import { getExtension } from './categoryService';
import { generateAndStoreChunks } from './chunkingService';

// Configure pdfjs worker for browser environment
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// ── Text Extraction Helpers ──────────────────────────────────────────────────

/**
 * Extract text from a PDF ArrayBuffer preserving page boundaries and numbers
 */
export async function extractTextFromPDF(data: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pageChunks: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const strings: string[] = [];
    for (const item of content.items) {
      if ('str' in item && typeof item.str === 'string') {
        const str = item.str.trim();
        if (str) strings.push(item.str);
      }
    }

    const pageText = strings.join(' ').replace(/\s+/g, ' ').trim();
    if (pageText) {
      pageChunks.push(`Page ${pageNum}:\n${pageText}`);
    } else {
      pageChunks.push(`Page ${pageNum}:\n[No extractable text on page]`);
    }
  }

  return pageChunks.join('\n\n').trim();
}

/**
 * Extract text from a DOCX ArrayBuffer (paragraphs, headings, tables)
 */
export async function extractTextFromDocx(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const docXmlFile = zip.file('word/document.xml');

  if (!docXmlFile) {
    throw new Error('Invalid DOCX format: word/document.xml not found.');
  }

  const xmlText = await docXmlFile.async('text');

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    const paragraphs: string[] = [];

    // Process all paragraphs and tables
    const body = xmlDoc.getElementsByTagName('w:body')[0];
    if (!body) return '';

    // Helper to get text from an element
    const extractRunText = (el: Element): string => {
      const textNodes = el.getElementsByTagName('w:t');
      const parts: string[] = [];
      for (let i = 0; i < textNodes.length; i++) {
        parts.push(textNodes[i].textContent || '');
      }
      return parts.join('');
    };

    // Iterate direct child nodes of body: w:p and w:tbl
    const children = Array.from(body.childNodes);
    for (const child of children) {
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const nodeName = el.nodeName.toLowerCase();

      if (nodeName === 'w:p') {
        const text = extractRunText(el).trim();
        if (text) {
          paragraphs.push(text);
        }
      } else if (nodeName === 'w:tbl') {
        // Extract table rows and cells
        const rows = el.getElementsByTagName('w:tr');
        const rowTexts: string[] = [];
        for (let r = 0; r < rows.length; r++) {
          const cells = rows[r].getElementsByTagName('w:tc');
          const cellTexts: string[] = [];
          for (let c = 0; c < cells.length; c++) {
            cellTexts.push(extractRunText(cells[c]).trim());
          }
          rowTexts.push(cellTexts.join(' | '));
        }
        if (rowTexts.length > 0) {
          paragraphs.push(rowTexts.join('\n'));
        }
      }
    }

    return paragraphs.join('\n\n').trim();
  } else {
    // Fallback regex parsing if DOMParser is unavailable
    const matches = xmlText.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
    return matches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ').trim();
  }
}

/**
 * Extract text from a PPTX ArrayBuffer (slides with slide numbers)
 */
export async function extractTextFromPptx(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const slideEntries: { num: number; file: JSZip.JSZipObject }[] = [];

  zip.forEach((relativePath, file) => {
    const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      slideEntries.push({ num: parseInt(match[1], 10), file });
    }
  });

  if (slideEntries.length === 0) {
    throw new Error('Invalid PPTX format: no slides found.');
  }

  // Sort slides numerically: Slide 1, Slide 2, ...
  slideEntries.sort((a, b) => a.num - b.num);

  const slideChunks: string[] = [];

  for (const entry of slideEntries) {
    const xmlText = await entry.file.async('text');
    let slideText = '';

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
      const paragraphs = xmlDoc.getElementsByTagName('a:p');
      const pTexts: string[] = [];

      for (let p = 0; p < paragraphs.length; p++) {
        const textNodes = paragraphs[p].getElementsByTagName('a:t');
        const runParts: string[] = [];
        for (let t = 0; t < textNodes.length; t++) {
          runParts.push(textNodes[t].textContent || '');
        }
        const line = runParts.join('').trim();
        if (line) pTexts.push(line);
      }
      slideText = pTexts.join('\n');
    } else {
      const matches = xmlText.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
      slideText = matches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ').trim();
    }

    slideChunks.push(`Slide ${entry.num}:\n${slideText || '[Empty slide]'}`);
  }

  return slideChunks.join('\n\n').trim();
}

/**
 * Extract text from a plain text Blob (TXT, MD, code)
 */
export async function extractTextFromTxt(blob: Blob): Promise<string> {
  const text = await blob.text();
  return text.trim();
}

// ── Text Extraction Dispatcher ───────────────────────────────────────────────

export interface ExtractionResult {
  text: string;
  status: ExtractionStatus;
  error?: string;
}

export async function extractDocumentText(
  blob: Blob,
  filename: string,
  _mimeType: string
): Promise<ExtractionResult> {
  const ext = getExtension(filename);

  // Check supported text extraction file types
  const isPdf = ext === 'pdf';
  const isDocx = ext === 'docx';
  const isPptx = ext === 'pptx';
  const isTxt = ['txt', 'md', 'java', 'py', 'c', 'cpp', 'js', 'ts', 'html', 'css', 'json', 'xml'].includes(ext);

  if (!isPdf && !isDocx && !isPptx && !isTxt) {
    return {
      text: '',
      status: 'unsupported',
      error: `File type ".${ext}" is not supported for text extraction in Phase 5A.`,
    };
  }

  try {
    let extractedText = '';

    if (isPdf) {
      const arrayBuffer = await blob.arrayBuffer();
      extractedText = await extractTextFromPDF(arrayBuffer);
    } else if (isDocx) {
      const arrayBuffer = await blob.arrayBuffer();
      extractedText = await extractTextFromDocx(arrayBuffer);
    } else if (isPptx) {
      const arrayBuffer = await blob.arrayBuffer();
      extractedText = await extractTextFromPptx(arrayBuffer);
    } else if (isTxt) {
      extractedText = await extractTextFromTxt(blob);
    }

    return {
      text: extractedText,
      status: 'completed',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown extraction error';
    console.error(`Text extraction failed for ${filename}:`, err);
    return {
      text: '',
      status: 'failed',
      error: errorMsg,
    };
  }
}

// ── Document Content Database Operations ────────────────────────────────────

/**
 * Fetch extracted content for a specific document
 */
export async function fetchDocumentContent(documentId: string): Promise<DocumentContent | null> {
  const { data, error } = await supabase
    .from('document_content')
    .select('*')
    .eq('document_id', documentId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || error.message?.toLowerCase().includes('schema cache')) {
      console.warn('Table "public.document_content" not found in Supabase schema cache.');
      return null;
    }
    console.error('Error fetching document content:', error);
    return null;
  }

  return data as DocumentContent | null;
}

/**
 * Fetch all extracted content records for the current user
 */
export async function fetchUserDocumentContents(userId: string): Promise<Record<string, DocumentContent>> {
  const { data, error } = await supabase
    .from('document_content')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    if (error.code === 'PGRST205' || error.message?.toLowerCase().includes('schema cache')) {
      console.warn('Table "public.document_content" not found in Supabase schema cache.');
      return {};
    }
    console.error('Error fetching user document contents:', error);
    return {};
  }

  const map: Record<string, DocumentContent> = {};
  for (const item of (data || []) as DocumentContent[]) {
    map[item.document_id] = item;
  }
  return map;
}

/**
 * Full Pipeline: Retrieve private file from Supabase Storage -> Extract text -> Store document_content
 * 
 * Safe & Idempotent:
 * - Does not duplicate document_content records (upserts on document_id).
 * - Never deletes or invalidates the original document if extraction fails.
 */
export async function processDocumentExtraction(doc: Document): Promise<DocumentContent | null> {
  const ext = getExtension(doc.filename);
  const isSupported = ['pdf', 'docx', 'pptx', 'txt', 'md', 'java', 'py', 'c', 'cpp', 'js', 'ts', 'html', 'css', 'json'].includes(ext);

  // 1. Initial pending/processing state
  const initialStatus: ExtractionStatus = isSupported ? 'processing' : 'unsupported';
  const now = new Date().toISOString();

  // Record initial status
  try {
    await supabase.from('document_content').upsert(
      {
        document_id: doc.id,
        user_id: doc.user_id,
        extracted_text: null,
        extraction_status: initialStatus,
        extraction_error: isSupported ? null : `File type ".${ext}" is not supported for text extraction.`,
        extracted_at: isSupported ? null : now,
        character_count: 0,
        word_count: 0,
        updated_at: now,
      },
      { onConflict: 'document_id' }
    );
  } catch (upsertErr) {
    console.warn('Could not record initial extraction status in document_content:', upsertErr);
  }

  if (!isSupported) {
    return {
      id: '',
      document_id: doc.id,
      user_id: doc.user_id,
      extracted_text: null,
      extraction_status: 'unsupported',
      extraction_error: `File type ".${ext}" is not supported for text extraction.`,
      extracted_at: now,
      character_count: 0,
      word_count: 0,
    };
  }

  // 2. Retrieve private file from Supabase Storage using authenticated client
  let blob: Blob;
  try {
    const { data: storageBlob, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(doc.storage_path);

    if (downloadError || !storageBlob) {
      throw new Error(downloadError?.message || 'Failed to download file from Supabase Storage');
    }

    blob = storageBlob;
  } catch (storageErr: unknown) {
    const msg = storageErr instanceof Error ? storageErr.message : 'Storage download error';
    console.error('Extraction storage download failed:', storageErr);

    const failRecord = {
      document_id: doc.id,
      user_id: doc.user_id,
      extracted_text: null,
      extraction_status: 'failed' as ExtractionStatus,
      extraction_error: `Storage download failed: ${msg}`,
      extracted_at: new Date().toISOString(),
      character_count: 0,
      word_count: 0,
      updated_at: new Date().toISOString(),
    };

    const { data: failedData } = await supabase
      .from('document_content')
      .upsert(failRecord, { onConflict: 'document_id' })
      .select()
      .maybeSingle();

    return failedData as DocumentContent | null;
  }

  // 3. Extract text
  const result = await extractDocumentText(blob, doc.filename, doc.mime_type);

  // 4. Compute metrics
  const text = result.text;
  const characterCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const extractedAt = new Date().toISOString();

  // 5. Store extracted content in database
  const contentRecord = {
    document_id: doc.id,
    user_id: doc.user_id,
    extracted_text: text || null,
    extraction_status: result.status,
    extraction_error: result.error || null,
    extracted_at: extractedAt,
    character_count: characterCount,
    word_count: wordCount,
    updated_at: extractedAt,
  };

  const { data: savedData, error: dbError } = await supabase
    .from('document_content')
    .upsert(contentRecord, { onConflict: 'document_id' })
    .select()
    .maybeSingle();

  if (dbError) {
    console.error('Failed to store document_content:', dbError);
    if (dbError.code === 'PGRST205' || dbError.message?.toLowerCase().includes('schema cache')) {
      console.warn(
        'Table "public.document_content" not found in Supabase. Run supabase/phase5a_document_text_extraction.sql in the Supabase SQL Editor.'
      );
    }
  }

  const finalContent = (savedData || {
    id: '',
    ...contentRecord,
  }) as DocumentContent;

  // Phase 5B: Trigger Document Text Chunking when extraction completes
  if (result.status === 'completed' && finalContent.id) {
    try {
      await generateAndStoreChunks(finalContent);

      // Phase 5C: Auto-trigger embedding generation after chunking completes.
      // The /api/embed-chunks endpoint handles authentication and key security
      // server-side. We fire-and-forget — a failure here doesn't affect the
      // document or its chunks.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        fetch('/api/embed-chunks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ documentId: doc.id }),
        })
          .then(async (embRes) => {
            const embJson = await embRes.json().catch(() => ({}));
            if (!embRes.ok) {
              console.warn('Phase 5C auto-embed returned non-OK status:', embRes.status, embJson);
            } else {
              console.log(`Phase 5C auto-embed complete — embedded: ${embJson.embedded ?? '?'} / ${embJson.total ?? '?'} chunks`);
            }
          })
          .catch((embErr) => {
            // Non-blocking: doc and chunks are safe even if this fails
            console.warn('Phase 5C auto-embed request failed (non-fatal):', embErr);
          });
      } else {
        console.warn('Phase 5C auto-embed skipped: no active session token.');
      }
    } catch (chunkErr) {
      // Non-blocking: document and document_content remain completely safe
      console.error('Phase 5B Chunking failed (document remains safe):', chunkErr);
    }
  }

  return finalContent;
}

