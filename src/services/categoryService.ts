import type { DocumentCategory } from '../types/document';

// ── Extension → file type display label ──────────────────────────────────────

const EXT_TYPE_MAP: Record<string, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  doc: 'Word',
  pptx: 'PPTX',
  ppt: 'PowerPoint',
  txt: 'Text',
  md: 'Markdown',
  png: 'PNG',
  jpg: 'JPEG',
  jpeg: 'JPEG',
  java: 'Java',
  py: 'Python',
  c: 'C',
  cpp: 'C++',
  js: 'JavaScript',
  ts: 'TypeScript',
  html: 'HTML',
  css: 'CSS',
};

export const ACCEPTED_EXTENSIONS = [
  'pdf',
  'docx',
  'doc',
  'pptx',
  'ppt',
  'png',
  'jpg',
  'jpeg',
  'txt',
  'md',
  'java',
  'py',
  'c',
  'cpp',
  'js',
  'ts',
  'html',
  'css',
];

export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/markdown',
  'text/x-java-source',
  'text/x-java',
  'text/x-python',
  'text/x-csrc',
  'text/x-c++src',
  'application/javascript',
  'text/javascript',
  'application/typescript',
  'text/typescript',
  'text/html',
  'text/css',
];

export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function getFileTypeLabel(input: File | string): string {
  const filename = typeof input === 'string' ? input : input.name;
  const ext = getExtension(filename);
  return EXT_TYPE_MAP[ext] ?? ext.toUpperCase() ?? 'FILE';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Category Suggestion Service ──────────────────────────────────────────────
// Architecture note: This rule-based classifier is intentionally isolated from UI
// components so it can be swapped with a future AI/Gemini classifier without rewriting
// the upload system.

const CODE_EXTS = new Set(['java', 'py', 'c', 'cpp', 'js', 'ts', 'html', 'css']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg']);

const ASSIGNMENT_KEYWORDS = [
  'assignment',
  'assign',
  'homework',
  'lab',
  'exercise',
  'problem',
  'question',
  'task',
  'pset',
  'hw',
];

const NOTES_KEYWORDS = [
  'notes',
  'note',
  'lecture',
  'chapter',
  'unit',
  'revision',
  'study',
  'lec',
  'chap',
  'summary',
  'class',
  'module',
];

function containsKeyword(name: string, keywords: string[]): boolean {
  // Strip extension
  const baseName = name.replace(/\.[^.]+$/, '').toLowerCase();

  return keywords.some((kw) => {
    // Match as distinct word or with trailing numbers (e.g., "lab", "lab1", "assignment_3", "lecture_notes")
    // Avoid substring matches within words (e.g., "lab" in "syllabus")
    const regex = new RegExp(`(^|[^a-z0-9])${kw}[0-9]*($|[^a-z0-9])`, 'i');
    if (regex.test(baseName)) return true;

    // Direct token comparison
    const tokens = baseName.split(/[^a-z0-9]+/).filter(Boolean);
    if (tokens.some((token) => token === kw || token.startsWith(kw))) return true;

    return false;
  });
}

export interface CategorySuggestion {
  category: DocumentCategory;
  confidence: number;
  reason: string;
}

export function suggestCategory(input: File | string): CategorySuggestion {
  const filename = typeof input === 'string' ? input : input.name;
  const ext = getExtension(filename);

  // 1. Code (extension-based)
  if (CODE_EXTS.has(ext)) {
    return {
      category: 'Code',
      confidence: 0.95,
      reason: `Detected code source extension ".${ext}"`,
    };
  }

  // 2. Images (extension-based)
  if (IMAGE_EXTS.has(ext)) {
    return {
      category: 'Images',
      confidence: 0.95,
      reason: `Detected image extension ".${ext}"`,
    };
  }

  // 3. Assignments (keyword in filename)
  if (containsKeyword(filename, ASSIGNMENT_KEYWORDS)) {
    return {
      category: 'Assignments',
      confidence: 0.85,
      reason: 'Matched assignment/coursework keyword in filename',
    };
  }

  // 4. Notes (keyword in filename)
  if (containsKeyword(filename, NOTES_KEYWORDS)) {
    return {
      category: 'Notes',
      confidence: 0.85,
      reason: 'Matched study/lecture keyword in filename',
    };
  }

  // 5. Default fallback
  return {
    category: 'Documents',
    confidence: 0.7,
    reason: 'Default general document categorization',
  };
}

export function getSuggestedCategory(input: File | string): DocumentCategory {
  return suggestCategory(input).category;
}

// ── File Validation ──────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File): ValidationResult {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const ext = getExtension(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: "This file type isn't supported.",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `This file is too large. Please choose a file smaller than ${MAX_FILE_SIZE_MB} MB.`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'The selected file is empty (0 bytes).',
    };
  }

  return { valid: true };
}

// ── User-Facing Display Filename Extractor ───────────────────────────────────

export function getDisplayFilename(filename: string): string {
  if (!filename) return 'Document';
  const basename = filename.split(/[/\\]/).pop() || filename;
  // If stored with a timestamp prefix (e.g. 1740661234567_filename.pdf or 20260927_filename.pdf)
  const timestampMatch = basename.match(/^\d{10,}_(.*)$/);
  if (timestampMatch && timestampMatch[1]) {
    return timestampMatch[1];
  }
  return basename;
}

// ── Reusable Category Counts Helper ──────────────────────────────────────────

export function computeCategoryCounts(
  documents: Array<{ category?: string }>
): Record<string, number> {
  const counts: Record<string, number> = {
    'All Knowledge': documents.length,
    Documents: 0,
    Notes: 0,
    Code: 0,
    Images: 0,
    Assignments: 0,
  };

  for (const doc of documents) {
    const cat = doc.category || 'Documents';
    if (cat in counts) {
      counts[cat]++;
    } else {
      counts.Documents++;
    }
  }

  return counts;
}
