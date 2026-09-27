import { AlertTriangle, Loader2 } from 'lucide-react';
import type { Document } from '../../types/document';

interface DeleteConfirmModalProps {
  doc: Document;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ doc, deleting, onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass-panel-elevated rounded-2xl border border-slate-700/60 p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Delete this document?</h3>
            <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-1">
          <span className="font-medium text-slate-100">{doc.filename}</span> will be permanently removed from your MemorySpace.
        </p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 text-sm font-medium transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="confirm-delete"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 border border-red-500/50 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting…</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
