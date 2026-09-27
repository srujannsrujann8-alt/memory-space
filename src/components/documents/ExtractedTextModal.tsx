import { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  RefreshCw,
  FileText,
  Clock,
  Hash,
  Layers,
  Cpu,
} from 'lucide-react';
import type { Document, DocumentContent, DocumentChunk } from '../../types/document';
import { fetchDocumentChunks } from '../../services/chunkingService';
import { triggerDocumentEmbedding } from '../../services/embeddingService';

interface ExtractedTextModalProps {
  doc: Document;
  content?: DocumentContent | null;
  onClose: () => void;
  onReprocess?: (doc: Document) => Promise<void>;
  isReprocessing?: boolean;
}

export function ExtractedTextModal({
  doc,
  content,
  onClose,
  onReprocess,
  isReprocessing = false,
}: ExtractedTextModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'chunks'>('text');
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedChunkIdx, setCopiedChunkIdx] = useState<number | null>(null);

  // Embedding trigger state
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [embeddingMessage, setEmbeddingMessage] = useState<string | null>(null);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);

  // Load document chunks for this document
  const loadChunks = async () => {
    if (!doc.id || content?.extraction_status !== 'completed') return;
    setLoadingChunks(true);
    try {
      const fetched = await fetchDocumentChunks(doc.id);
      setChunks(fetched);
    } catch (err) {
      console.warn('Could not load chunks for modal:', err);
    } finally {
      setLoadingChunks(false);
    }
  };

  useEffect(() => {
    loadChunks();
  }, [doc.id, content?.extraction_status, isReprocessing]);

  const handleTriggerEmbeddings = async (forceRetry = false) => {
    setIsEmbedding(true);
    setEmbeddingMessage(null);
    setEmbeddingError(null);
    try {
      const res = await triggerDocumentEmbedding(doc.id, forceRetry);
      if (res.success) {
        setEmbeddingMessage(`Successfully generated ${res.embedded} embeddings.`);
      } else {
        setEmbeddingMessage(res.message || 'Embeddings processed.');
      }
      await loadChunks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Embedding generation failed';
      setEmbeddingError(msg);
    } finally {
      setIsEmbedding(false);
    }
  };

  const handleCopyText = () => {
    if (!content?.extracted_text) return;
    navigator.clipboard.writeText(content.extracted_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyChunk = (chunkText: string, idx: number) => {
    navigator.clipboard.writeText(chunkText);
    setCopiedChunkIdx(idx);
    setTimeout(() => setCopiedChunkIdx(null), 2000);
  };

  const status = content?.extraction_status ?? 'pending';

  // Compute embedding summary
  const embeddedCount = chunks.filter((c) => c.embedding_status === 'completed').length;
  const failedEmbedCount = chunks.filter((c) => c.embedding_status === 'failed').length;
  const isAllEmbedded = chunks.length > 0 && embeddedCount === chunks.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="glass-panel w-full max-w-3xl max-h-[88vh] rounded-2xl border border-cyan-500/30 bg-[#090d16] p-6 shadow-2xl flex flex-col gap-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate" title={doc.filename}>
                Document Intelligence: {doc.filename}
              </h3>
              <p className="text-xs text-slate-400">
                Phase 5A (Extraction) • Phase 5B (Chunks) • Phase 5C (Embeddings)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata Chips Bar */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
          {/* Status Badge */}
          {status === 'completed' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
              <Sparkles className="w-3 h-3" />
              Extracted
            </span>
          )}
          {status === 'processing' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Processing
            </span>
          )}
          {status === 'failed' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 font-semibold">
              <AlertCircle className="w-3 h-3" />
              Failed
            </span>
          )}
          {status === 'unsupported' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-400 font-semibold">
              Unsupported Format
            </span>
          )}
          {status === 'pending' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-400 font-semibold">
              Pending Extraction
            </span>
          )}

          {/* Stats if available */}
          {content && status === 'completed' && (
            <>
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                <Hash className="w-3 h-3 text-cyan-400" />
                {content.word_count.toLocaleString()} words
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                <Hash className="w-3 h-3 text-cyan-400" />
                {content.character_count.toLocaleString()} chars
              </span>
              {/* Phase 5B Chunks Chip */}
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
                <Layers className="w-3 h-3 text-cyan-400" />
                {loadingChunks ? 'Counting chunks...' : `Chunks: ${chunks.length}`}
              </span>
              {/* Phase 5C Embeddings Chip */}
              {chunks.length > 0 && (
                <span
                  className={`flex items-center gap-1 px-2 py-1 rounded-md font-semibold ${
                    isAllEmbedded
                      ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300'
                      : failedEmbedCount > 0
                      ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                      : 'bg-slate-900 border border-slate-800 text-slate-400'
                  }`}
                >
                  <Cpu className="w-3 h-3 text-indigo-400" />
                  Embeddings: {embeddedCount}/{chunks.length} {isAllEmbedded ? 'Completed' : ''}
                </span>
              )}
              {content.extracted_at && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                  <Clock className="w-3 h-3" />
                  {new Date(content.extracted_at).toLocaleTimeString()}
                </span>
              )}
            </>
          )}
        </div>

        {/* Embedding Feedback Banners */}
        {embeddingMessage && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{embeddingMessage}</span>
          </div>
        )}

        {embeddingError && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Embedding Generation Notice</p>
              <p className="font-mono text-[11px] text-red-300/80 mt-0.5">{embeddingError}</p>
            </div>
          </div>
        )}

        {/* View Toggle (Full Text vs Chunks) */}
        {status === 'completed' && (
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('text')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'text'
                    ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Full Extracted Text
              </button>
              <button
                onClick={() => setActiveTab('chunks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'chunks'
                    ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Chunks ({chunks.length})</span>
              </button>
            </div>

            {/* Embedding Generation Button */}
            {chunks.length > 0 && (
              <button
                onClick={() => handleTriggerEmbeddings(!isAllEmbedded ? false : true)}
                disabled={isEmbedding}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-500/40 hover:bg-indigo-900/60 text-indigo-300 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
                title="Generate or update 768-dimensional embeddings via Google Gemini text-embedding-004"
              >
                <Cpu className={`w-3.5 h-3.5 text-indigo-400 ${isEmbedding ? 'animate-spin' : ''}`} />
                <span>
                  {isEmbedding
                    ? 'Generating Embeddings...'
                    : !isAllEmbedded
                    ? 'Generate Embeddings'
                    : 'Re-embed Chunks'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Content Body Area */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl bg-slate-950/80 border border-slate-800/80 p-4">
          {status === 'completed' && activeTab === 'text' && (
            content?.extracted_text ? (
              <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap break-words leading-relaxed select-text">
                {content.extracted_text}
              </pre>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs font-mono">
                [Document contained no extractable textual content]
              </div>
            )
          )}

          {status === 'completed' && activeTab === 'chunks' && (
            chunks.length > 0 ? (
              <div className="space-y-3">
                {chunks.map((chunk) => (
                  <div
                    key={chunk.id || chunk.chunk_index}
                    className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 transition-colors space-y-2 group"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400 pb-1.5 border-b border-slate-800/60 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-semibold">
                          Chunk #{chunk.chunk_index}
                        </span>
                        {chunk.page_number !== null && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                            Page {chunk.page_number}
                          </span>
                        )}
                        {chunk.slide_number !== null && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                            Slide {chunk.slide_number}
                          </span>
                        )}
                        <span>{chunk.character_count} chars</span>
                        <span>•</span>
                        <span>{chunk.word_count} words</span>

                        {/* Phase 5C Embedding Badge */}
                        {chunk.embedding_status === 'completed' ? (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-semibold flex items-center gap-1">
                            <Cpu className="w-2.5 h-2.5 text-indigo-400" />
                            768d Vector
                          </span>
                        ) : chunk.embedding_status === 'failed' ? (
                          <span
                            className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 font-semibold flex items-center gap-1"
                            title={chunk.embedding_error || 'Embedding generation failed'}
                          >
                            <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                            Embedding failed
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                            Pending embedding
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleCopyChunk(chunk.content, chunk.chunk_index)}
                        className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy chunk content"
                      >
                        {copiedChunkIdx === chunk.chunk_index ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <p className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs font-mono">
                {loadingChunks
                  ? 'Loading document chunks…'
                  : 'No chunks generated yet for this document.'}
              </div>
            )
          )}

          {status === 'failed' && (
            <div className="py-6 space-y-3">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Text extraction encountered an error</p>
                  <p className="mt-1 text-slate-400 font-mono text-[11px]">
                    {content?.extraction_error || 'Unknown extraction failure'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                The original file remains safely stored in Supabase. You can retry the extraction pipeline.
              </p>
            </div>
          )}

          {status === 'unsupported' && (
            <div className="py-8 text-center text-slate-400 text-xs font-mono">
              Text extraction is not supported for this file type in Phase 5A.
              <br />
              Supported types: PDF, DOCX, PPTX, TXT.
            </div>
          )}

          {status === 'pending' && (
            <div className="py-8 text-center text-slate-400 text-xs font-mono">
              Text has not been extracted for this document yet.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div>
            {onReprocess && (status === 'failed' || status === 'pending' || !content) && (
              <button
                onClick={() => onReprocess(doc)}
                disabled={isReprocessing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/60 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReprocessing ? 'animate-spin' : ''}`} />
                <span>{isReprocessing ? 'Processing...' : 'Extract & Chunk Text Now'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {status === 'completed' && activeTab === 'text' && content?.extracted_text && (
              <button
                onClick={handleCopyText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium transition-all cursor-pointer"
                title="Copy extracted text"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
