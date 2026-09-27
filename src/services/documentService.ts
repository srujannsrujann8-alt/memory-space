import { supabase } from '../lib/supabase';
import type { Document, DocumentInsert } from '../types/document';

export const BUCKET_NAME =
  (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string) || 'knowledge-files';

// ── Fetch user documents ─────────────────────────────────────────────────────

export async function fetchDocuments(userId?: string): Promise<Document[]> {
  let query = supabase
    .from('documents')
    .select('*')
    .order('uploaded_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching documents:', error);
    // If the table does not exist in schema cache yet, return empty list gracefully
    if (error.code === 'PGRST205' || error.message?.toLowerCase().includes('schema cache')) {
      console.warn('Table "public.documents" not found in Supabase schema cache.');
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as Document[];
}

// ── Search documents locally by metadata ─────────────────────────────────────
// Case-insensitive search over the user's real documents across:
// - filename
// - category
// - file_type
// - mime_type
export function searchDocumentsLocally(documents: Document[], query: string): Document[] {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return documents;

  return documents.filter((doc) => {
    const filenameMatch = (doc.filename || '').toLowerCase().includes(cleanQ);
    const categoryMatch = (doc.category || '').toLowerCase().includes(cleanQ);
    const fileTypeMatch = (doc.file_type || '').toLowerCase().includes(cleanQ);
    const mimeTypeMatch = (doc.mime_type || '').toLowerCase().includes(cleanQ);
    return filenameMatch || categoryMatch || fileTypeMatch || mimeTypeMatch;
  });
}

// ── Upload file to Storage + insert metadata into DB ─────────────────────────

export async function uploadDocument(
  file: File,
  meta: Omit<DocumentInsert, 'storage_path'>,
  onProgress?: (pct: number) => void,
): Promise<Document> {
  if (!meta.user_id) {
    throw new Error('User is not authenticated.');
  }

  // 1. Build clean user-isolated storage path: {user_id}/{timestamp}_{filename}
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${meta.user_id}/${Date.now()}_${safeName}`;

  if (onProgress) onProgress(20);

  // 2. Upload file to Supabase Storage bucket
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    const errorMsg = uploadError.message || '';
    const errObj = uploadError as { code?: string; statusCode?: string };

    if (
      errorMsg.toLowerCase().includes('bucket not found') ||
      errObj.code === 'NoSuchBucket' ||
      errObj.statusCode === '404'
    ) {
      throw new Error(
        `Bucket "${BUCKET_NAME}" not found in your Supabase project. Please create the "${BUCKET_NAME}" storage bucket in your Supabase Dashboard (under Storage → New bucket) or run the SQL in supabase/phase3_documents_and_storage.sql.`
      );
    }

    if (
      errorMsg.toLowerCase().includes('permission denied') ||
      errorMsg.toLowerCase().includes('row-level security') ||
      errObj.statusCode === '403'
    ) {
      throw new Error(
        `Storage upload permission denied. Please verify that the Storage RLS policies in supabase/phase3_documents_and_storage.sql are applied.`
      );
    }

    throw new Error(`Upload failed: ${errorMsg}`);
  }

  if (onProgress) onProgress(70);

  // 3. Insert metadata into database
  const insertPayload: DocumentInsert = {
    ...meta,
    storage_path: storagePath,
  };

  const { data: dbData, error: dbError } = await supabase
    .from('documents')
    .insert(insertPayload)
    .select()
    .single();

  if (dbError) {
    console.error('Database insert error, rolling back storage:', dbError);
    // Roll back storage file if database record insertion fails
    try {
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    } catch (cleanupErr) {
      console.warn('Failed to clean up storage orphan:', cleanupErr);
    }

    if (
      dbError.code === 'PGRST205' ||
      dbError.message?.toLowerCase().includes('schema cache') ||
      dbError.message?.toLowerCase().includes('does not exist')
    ) {
      throw new Error(
        `Table "public.documents" not found in Supabase. Please run the SQL migration in supabase/phase3_documents_and_storage.sql in the Supabase SQL Editor.`
      );
    }

    throw new Error(`Database error: ${dbError.message}`);
  }

  if (onProgress) onProgress(100);

  return dbData as Document;
}

// ── Delete a document ────────────────────────────────────────────────────────

export async function deleteDocument(doc: Document): Promise<void> {
  // 1. Explicitly clean up document_content & document_chunks records (belt-and-suspenders with CASCADE)
  try {
    await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', doc.id);
  } catch (chunkErr) {
    console.warn('Explicit document_chunks delete warning (will be handled by CASCADE):', chunkErr);
  }

  try {
    await supabase
      .from('document_content')
      .delete()
      .eq('document_id', doc.id);
  } catch (contentErr) {
    console.warn('Explicit document_content delete warning (will be handled by CASCADE):', contentErr);
  }

  // 1b. Clean up document_topics (Phase 8C)
  try {
    await supabase
      .from('document_topics')
      .delete()
      .eq('document_id', doc.id);
  } catch (topicErr) {
    console.warn('Explicit document_topics delete warning (will be handled by CASCADE):', topicErr);
  }

  // 2. Remove database record
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', doc.id);

  if (dbError) {
    console.error('Database deletion error:', dbError);
    throw new Error(dbError.message);
  }

  // 2. Clean up storage object
  if (doc.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([doc.storage_path]);

    if (storageError) {
      console.warn('Storage file cleanup warning:', storageError);
    }
  }
}

// ── Secure access via signed URL ─────────────────────────────────────────────

export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 3600); // 1 hour valid

  if (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(error.message);
  }

  return data.signedUrl;
}

// ── Download file to user's machine ──────────────────────────────────────────
// Uses supabase.storage.download() which sends the authenticated user's JWT,
// so the bucket stays private and RLS is fully respected.
// The file is received as a Blob and saved under the original filename.

export async function downloadDocument(doc: Document): Promise<void> {
  const { data: blob, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(doc.storage_path);

  if (error) {
    console.error('Storage download error:', error);
    throw new Error(error.message);
  }

  // Create a temporary object URL, click it to trigger the Save dialog,
  // then immediately revoke it to free memory.
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = doc.filename; // preserves the original filename
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

// ── Open document by document_id (Phase 7 RAG / Semantic Search) ─────────────
// 1. Validates authenticated user session
// 2. Queries public.documents by document_id with RLS protection
// 3. Verifies user ownership
// 4. Resolves storage_path and creates a signed private URL using getDocumentUrl()
// 5. Opens the signed URL in a new browser tab with window.open
// 6. Gracefully falls back if popups are blocked or document is non-previewable

export async function openDocument(docId: string): Promise<string> {
  if (!docId) {
    throw new Error('Document ID is required.');
  }

  // 1. Get authenticated user
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    throw new Error('You must be logged in to open documents.');
  }

  // 2. Fetch document record (RLS enforces user isolation)
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('id, user_id, filename, file_type, mime_type, storage_path')
    .eq('id', docId)
    .single();

  if (fetchError || !doc) {
    console.error('[documentService] Failed to fetch document:', fetchError?.message || 'Document not found');
    throw new Error('Unable to open this document.');
  }

  // 3. Confirm document ownership
  if (doc.user_id !== session.user.id) {
    console.error('[documentService] Ownership mismatch for document:', docId);
    throw new Error('Unable to open this document.');
  }

  if (!doc.storage_path) {
    console.error('[documentService] Document has no storage_path:', docId);
    throw new Error('Unable to open this document.');
  }

  // 4. Check if previewable in browser
  const ext = (doc.filename || '').split('.').pop()?.toLowerCase();
  const isPreviewable =
    ext === 'pdf' ||
    ext === 'txt' ||
    ext === 'md' ||
    doc.file_type === 'pdf' ||
    doc.file_type === 'txt' ||
    doc.mime_type?.startsWith('image/') ||
    doc.mime_type?.startsWith('text/') ||
    doc.mime_type === 'application/pdf';

  if (!isPreviewable) {
    // For non-previewable files (docx, pptx, zip), download securely
    await downloadDocument(doc as Document);
    return '';
  }

  // 5. Generate secure signed URL using existing getDocumentUrl
  const signedUrl = await getDocumentUrl(doc.storage_path);

  // 6. Open in a new browser tab with secure attributes
  const win = window.open(signedUrl, '_blank', 'noopener,noreferrer');
  if (!win || win.closed || typeof win.closed === 'undefined') {
    // Popup was blocked by browser — fallback to anchor click
    const anchor = document.createElement('a');
    anchor.href = signedUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  return signedUrl;
}

