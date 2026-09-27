import { useState } from 'react';
import {
  ExternalLink,
  Target,
  Sparkles,
  X,
  CheckCircle2,
  Download,
  Loader2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import type { GraphNodeItem } from '../types/graph';
import type { Document } from '../types/document';
import { getDocumentUrl, downloadDocument } from '../services/documentService';

export interface SearchResultProps {
  resultNode?: GraphNodeItem | null;
  resultDoc?: Document | null;
  onClose: () => void;
  onFocusNode?: (node: GraphNodeItem) => void;
  onOpenDocument?: (doc: Document) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export const SearchResult = ({
  resultNode,
  resultDoc,
  onClose,
  onFocusNode,
  onOpenDocument,
}: SearchResultProps) => {
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // If neither node nor doc is present, render nothing
  if (!resultNode && !resultDoc) return null;

  // Real document handling
  const isRealDoc = !!resultDoc;
  const effectiveDoc = resultDoc || resultNode?.realDoc;
  const title = effectiveDoc ? effectiveDoc.filename : resultNode!.name;
  const category = effectiveDoc ? effectiveDoc.category : resultNode!.category;
  const sourceName = effectiveDoc ? effectiveDoc.filename : (resultNode!.sourceFile || resultNode!.name);
  const contextSnippet = effectiveDoc
    ? `Document indexed under ${effectiveDoc.category}. Added to your personal knowledge base.`
    : (resultNode!.summarySnippet || resultNode!.description);

  const handleOpen = async () => {
    setActionError(null);
    if (effectiveDoc) {
      if (onOpenDocument) {
        onOpenDocument(effectiveDoc);
        return;
      }
      setOpening(true);
      try {
        const url = await getDocumentUrl(effectiveDoc.storage_path);
        window.open(url, '_blank', 'noopener');
      } catch (err) {
        console.error('Failed to open document:', err);
        setActionError('Unable to open this file.');
      } finally {
        setOpening(false);
      }
    }
  };

  const handleDownload = async () => {
    if (!resultDoc) return;
    setDownloading(true);
    setActionError(null);
    try {
      await downloadDocument(resultDoc);
    } catch (err) {
      console.error('Download failed:', err);
      setActionError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed bottom-[185px] sm:bottom-[205px] right-4 sm:right-8 z-30 pointer-events-none max-w-lg w-[calc(100vw-2rem)] sm:w-[440px]">
      <div className="pointer-events-auto glass-panel-elevated rounded-2xl p-5 border border-cyan-500/40 shadow-[0_15px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(56,189,248,0.2)] overflow-hidden relative transition-all duration-300 opacity-100 translate-y-0">
        {/* Subtle background glow effect */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header Badge */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
            </span>
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Memory Found
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Dismiss Result"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Matched Title */}
        <h3 className="text-lg font-bold text-white mb-1.5 flex items-center gap-2">
          <span className="truncate" title={title}>{title}</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        </h3>

        {/* Category Pill */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {category}
          </span>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs text-slate-400">
            {isRealDoc ? (
              <span>{formatSize(resultDoc!.file_size)} • {resultDoc!.file_type.toUpperCase()}</span>
            ) : (
              <span>{resultNode!.documents} connected file{resultNode!.documents > 1 ? 's' : ''}</span>
            )}
          </span>
        </div>

        {/* Context Snippet */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-4 text-xs text-slate-300 leading-relaxed font-mono">
          <p className="text-cyan-200/90 italic">
            &ldquo;{contextSnippet}&rdquo;
          </p>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800 mb-4">
          <div>
            <span className="text-[10px] font-mono text-slate-400 block uppercase">
              Source
            </span>
            <span className="text-xs font-semibold text-slate-200 truncate block mt-0.5" title={sourceName}>
              {sourceName}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-400 block uppercase">
              {isRealDoc ? 'Uploaded' : 'Page'}
            </span>
            <span className="text-xs font-semibold text-slate-200 block mt-0.5 font-mono truncate">
              {isRealDoc
                ? new Date(resultDoc!.uploaded_at).toLocaleDateString()
                : (resultNode!.page || 18)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-400 block uppercase">
              {isRealDoc ? 'Format' : 'Confidence'}
            </span>
            <span className="text-xs font-bold text-emerald-400 block mt-0.5 font-mono">
              {isRealDoc ? resultDoc!.file_type.toUpperCase() : `${resultNode!.confidence || 94}%`}
            </span>
          </div>
        </div>

        {/* Action Error if any */}
        {actionError && (
          <div className="flex items-center gap-2 p-2 mb-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{actionError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isRealDoc ? (
            <>
              <button
                onClick={handleOpen}
                disabled={opening || downloading}
                className="flex-1 py-2 px-3 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(56,189,248,0.15)] cursor-pointer disabled:opacity-50"
              >
                {opening ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>{opening ? 'Opening...' : 'Open File'}</span>
              </button>

              <button
                onClick={handleDownload}
                disabled={opening || downloading}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{downloading ? 'Saving...' : 'Download'}</span>
              </button>
            </>
          ) : (
            <>
              {onFocusNode && (
                <button
                  onClick={() => onFocusNode(resultNode!)}
                  className="flex-1 py-2 px-3 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(56,189,248,0.15)] cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Focus 3D Node</span>
                </button>
              )}

              <button
                onClick={handleOpen}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span>Open Document</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
