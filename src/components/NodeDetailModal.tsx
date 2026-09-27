import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  FileText,
  Network,
  ArrowUpRight,
  ExternalLink,
  Download,
  Loader2,
  Clock,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import type { GraphNodeItem } from '../services/graphService';
import { getDocumentUrl, downloadDocument } from '../services/documentService';
import { getDisplayFilename } from '../services/categoryService';

interface NodeDetailModalProps {
  node: GraphNodeItem;
  allNodes: GraphNodeItem[];
  onClose: () => void;
  onSelectRelated: (id: string) => void;
  onFilterCategory?: (category: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return 'Today';
  }
  return d.toLocaleDateString();
}

export const NodeDetailModal = ({
  node,
  allNodes,
  onClose,
  onSelectRelated,
  onFilterCategory,
}: NodeDetailModalProps) => {
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Find related node objects
  const relatedNodes = allNodes.filter((n) => node.related.includes(n.id));
  const realDoc = node.realDoc;
  const isCategory = node.isCategoryNode;
  const isRoot = node.isRootNode;

  const handleOpenDoc = async () => {
    if (!realDoc) return;
    setOpening(true);
    setActionError(null);
    try {
      const url = await getDocumentUrl(realDoc.storage_path);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      console.error('Open document failed:', err);
      setActionError('Could not open this file.');
    } finally {
      setOpening(false);
    }
  };

  const handleDownloadDoc = async () => {
    if (!realDoc) return;
    setDownloading(true);
    setActionError(null);
    try {
      await downloadDocument(realDoc);
    } catch (err) {
      console.error('Download document failed:', err);
      setActionError('Could not download this file.');
    } finally {
      setDownloading(false);
    }
  };

  const handleViewInDocuments = () => {
    const targetCat = realDoc ? realDoc.category : isCategory ? node.name : 'All Knowledge';
    navigate(`/documents?category=${encodeURIComponent(targetCat)}`);
  };

  return (
    <div className="fixed top-24 right-4 sm:right-8 z-30 pointer-events-none max-w-sm w-full">
      <div className="pointer-events-auto glass-panel-elevated rounded-2xl p-5 border border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.7)] transition-all duration-300 opacity-100 translate-x-0">
        {/* Top Header Badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <span
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-1.5"
              style={{
                backgroundColor: `${node.color}22`,
                color: node.color,
                border: `1px solid ${node.color}44`,
              }}
            >
              {isRoot ? 'MemorySpace Root' : isCategory ? 'CATEGORY' : node.category}
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight truncate" title={node.name}>
              {getDisplayFilename(node.name)}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
            title="Close Info"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Information Block (Section 10 Requirement) */}
        {isCategory && (
          <div className="mb-4">
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono uppercase text-[10px]">Category</span>
                <span className="font-semibold text-white">{node.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono uppercase text-[10px]">Files</span>
                <span className="font-mono font-bold text-cyan-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  {node.documents}
                </span>
              </div>
            </div>

            <button
              onClick={handleViewInDocuments}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700/90 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>View {node.name} in Documents</span>
            </button>
          </div>
        )}

        {/* Real Document Metadata (Section 11 Requirement) */}
        {realDoc && (
          <div className="grid grid-cols-2 gap-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 mb-4 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Category</span>
              <span className="font-semibold text-cyan-300 mt-0.5 block">{realDoc.category}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Type</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">{realDoc.file_type.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Size</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">{formatSize(realDoc.file_size)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-cyan-400" /> Uploaded
              </span>
              <span className="text-slate-200 font-semibold mt-0.5 block">{formatDate(realDoc.uploaded_at)}</span>
            </div>
          </div>
        )}

        {/* Description / Summary */}
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          {node.description}
        </p>

        {/* Connected Graph Hierarchy Section */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {isRoot
                ? 'Connected Categories'
                : isCategory
                ? 'Documents in Category'
                : 'Category Cluster'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
            {relatedNodes.length > 0 ? (
              relatedNodes.map((rel) => (
                <button
                  key={rel.id}
                  onClick={() => onSelectRelated(rel.id)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-cyan-950/80 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-200 text-xs font-medium flex items-center gap-1 transition-all group cursor-pointer max-w-full truncate"
                  title={rel.name}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: rel.color }}
                  />
                  <span className="truncate">{getDisplayFilename(rel.name)}</span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-cyan-300 transition-colors flex-shrink-0" />
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">No direct connections</span>
            )}
          </div>
        </div>

        {/* Action Error if any */}
        {actionError && (
          <div className="flex items-center gap-2 p-2 mb-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{actionError}</span>
          </div>
        )}

        {/* Document Action Buttons (Section 11 Requirement: Open Document & View in Documents) */}
        {realDoc && (
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenDoc}
                disabled={opening || downloading}
                className="flex-1 py-2 px-3 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(56,189,248,0.15)] cursor-pointer disabled:opacity-50"
              >
                {opening ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>{opening ? 'Opening...' : 'Open Document'}</span>
              </button>

              <button
                onClick={handleDownloadDoc}
                disabled={opening || downloading}
                className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Download local copy"
              >
                {downloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>Save</span>
              </button>
            </div>

            <button
              onClick={handleViewInDocuments}
              className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>View in Documents</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
