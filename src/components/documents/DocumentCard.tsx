import { useState } from 'react';
import {
  FileText, Code, Image, BookOpen, FolderGit2,
  Trash2, ExternalLink, Download, Clock, HardDrive, Loader2,
  Sparkles, AlertCircle, LucideIcon,
} from 'lucide-react';
import type { Document, DocumentContent } from '../../types/document';
import { getDocumentUrl, downloadDocument } from '../../services/documentService';

interface DocumentCardProps {
  doc: Document;
  content?: DocumentContent | null;
  onDelete: (doc: Document) => void;
  onViewContent?: (doc: Document) => void;
  onReprocess?: (doc: Document) => void;
  isReprocessing?: boolean;
}

const CATEGORY_STYLES: Record<string, { border: string; bg: string; text: string; icon: LucideIcon }> = {
  Documents:   { border: 'border-sky-500/30',    bg: 'bg-sky-500/10',    text: 'text-sky-300',    icon: FileText  },
  Notes:       { border: 'border-violet-500/30', bg: 'bg-violet-500/10', text: 'text-violet-300', icon: BookOpen  },
  Code:        { border: 'border-emerald-500/30',bg: 'bg-emerald-500/10',text: 'text-emerald-300',icon: Code      },
  Images:      { border: 'border-pink-500/30',   bg: 'bg-pink-500/10',   text: 'text-pink-300',   icon: Image     },
  Assignments: { border: 'border-amber-500/30',  bg: 'bg-amber-500/10',  text: 'text-amber-300',  icon: FolderGit2},
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString();
}

export function DocumentCard({
  doc,
  content,
  onDelete,
  onViewContent,
  onReprocess,
  isReprocessing = false,
}: DocumentCardProps) {
  const [opening,     setOpening]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const style = CATEGORY_STYLES[doc.category] ?? CATEGORY_STYLES.Documents;
  const Icon  = style.icon;

  // ── Open in new tab via signed URL (bucket stays private) ─────────────────
  const handleOpen = async () => {
    setOpening(true);
    setActionError(null);
    try {
      const url = await getDocumentUrl(doc.storage_path);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      console.error('Open failed:', err);
      setActionError('Could not open this file. Please try again.');
    } finally {
      setOpening(false);
    }
  };

  // ── Download to disk (Blob via authenticated client, preserves filename) ───
  const handleDownload = async () => {
    setDownloading(true);
    setActionError(null);
    try {
      await downloadDocument(doc);
    } catch (err) {
      console.error('Download failed:', err);
      setActionError('Could not download this file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={`glass-panel rounded-xl border ${style.border} p-4 flex flex-col gap-3 hover:shadow-[0_0_20px_rgba(56,189,248,0.1)] transition-all duration-200 group`}
    >
      {/* Top row: icon + info + action buttons */}
      <div className="flex items-start justify-between gap-4">
        {/* Left: Icon + Info */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center flex-shrink-0`}
          >
            <Icon className={`w-5 h-5 ${style.text}`} />
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-semibold text-slate-100 truncate group-hover:text-white transition-colors"
              title={doc.filename}
            >
              {doc.filename}
            </p>

            {/* Badges: File type, Category, Extraction status */}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span
                className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}
              >
                {doc.file_type}
              </span>
              <span className={`text-[11px] font-medium ${style.text}`}>{doc.category}</span>

              {/* Phase 5A: Extraction status badge */}
              {content && content.extraction_status === 'completed' && (
                <button
                  type="button"
                  onClick={() => onViewContent?.(doc)}
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                  title="Click to view extracted text"
                >
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Extracted {content.word_count > 0 ? `(${content.word_count.toLocaleString()} w)` : ''}</span>
                </button>
              )}

              {content && content.extraction_status === 'processing' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 animate-pulse">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>Processing</span>
                </span>
              )}

              {content && content.extraction_status === 'failed' && (
                <button
                  type="button"
                  onClick={() => onViewContent?.(doc)}
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer"
                  title="Extraction failed. Click to view details."
                >
                  <AlertCircle className="w-2.5 h-2.5" />
                  <span>Extraction failed</span>
                </button>
              )}

              {content && content.extraction_status === 'unsupported' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/80 text-slate-400">
                  <span>Unsupported</span>
                </span>
              )}

              {!content && (
                <button
                  type="button"
                  onClick={() => onReprocess?.(doc)}
                  disabled={isReprocessing}
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 transition-colors cursor-pointer disabled:opacity-50"
                  title="Extract text for this document"
                >
                  {isReprocessing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <FileText className="w-2.5 h-2.5" />}
                  <span>{isReprocessing ? 'Extracting...' : 'Extract text'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(doc.uploaded_at)}
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                {formatSize(doc.file_size)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* View Extracted Text Button (if extracted) */}
          {content && content.extraction_status === 'completed' && (
            <button
              onClick={() => onViewContent?.(doc)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/50 text-emerald-300 text-xs font-medium transition-all cursor-pointer"
              title="View extracted text"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Text</span>
            </button>
          )}

          {/* Open */}
          <button
            onClick={handleOpen}
            disabled={opening || downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
            title="Open file in new tab"
          >
            {opening
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <ExternalLink className="w-3.5 h-3.5" />}
            Open
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={opening || downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-cyan-300 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
            title={`Download ${doc.filename}`}
          >
            {downloading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Download className="w-3.5 h-3.5" />}
            Save
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(doc)}
            disabled={opening || downloading}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40 cursor-pointer"
            title="Delete document"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inline error banner — only shown when an action fails */}
      {actionError && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-red-400/70 hover:text-red-300 transition-colors flex-shrink-0 cursor-pointer"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
