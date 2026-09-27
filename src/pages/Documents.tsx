import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { CategoryFilter, FilterCategory } from '../components/documents/CategoryFilter';
import { DocumentCard } from '../components/documents/DocumentCard';
import { EmptyDocumentsState } from '../components/documents/EmptyDocumentsState';
import { DeleteConfirmModal } from '../components/documents/DeleteConfirmModal';
import { ExtractedTextModal } from '../components/documents/ExtractedTextModal';
import { fetchDocuments, deleteDocument } from '../services/documentService';
import { fetchUserDocumentContents, processDocumentExtraction } from '../services/extractionService';
import { triggerPendingEmbeddings } from '../services/embeddingService';
import { computeCategoryCounts } from '../services/categoryService';
import { useAuth } from '../context/AuthContext';
import type { Document, DocumentContent } from '../types/document';
import { Plus, RefreshCw, AlertCircle, HardDrive } from 'lucide-react';

export function Documents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [contents, setContents] = useState<Record<string, DocumentContent>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryParam = searchParams.get('category');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>(
    (categoryParam as FilterCategory) || 'All Knowledge'
  );

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam as FilterCategory);
    } else {
      setSelectedCategory('All Knowledge');
    }
  }, [categoryParam]);

  // Deletion state
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Extracted text preview & reprocessing modal state
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [reprocessingDocId, setReprocessingDocId] = useState<string | null>(null);

  // Load documents and their extraction status
  const loadDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [docs, userContents] = await Promise.all([
        fetchDocuments(user.id),
        fetchUserDocumentContents(user.id),
      ]);
      setDocuments(docs);
      setContents(userContents);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError('Unable to load your documents. Please verify your connection or try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Phase 5C Backfill trigger
  useEffect(() => {
    if (user) {
      triggerPendingEmbeddings()
        .then(res => {
          if (res.embedded > 0 || res.failed > 0) {
            console.log(`Backfill result: ${res.embedded} embedded, ${res.failed} failed out of ${res.total} total pending.`);
          }
        })
        .catch(err => console.error('Backfill trigger failed:', err));
    }
  }, [user]);

  // Handle re-running extraction for a document
  const handleReprocess = async (doc: Document) => {
    setReprocessingDocId(doc.id);
    try {
      const updated = await processDocumentExtraction(doc);
      if (updated) {
        setContents((prev) => ({
          ...prev,
          [doc.id]: updated,
        }));
      }
    } catch (err) {
      console.error('Reprocess extraction failed:', err);
    } finally {
      setReprocessingDocId(null);
    }
  };

  // Compute real counts per category (shared with KnowledgeGraph)
  const categoryCounts = useMemo<Record<FilterCategory, number>>(() => {
    return computeCategoryCounts(documents) as Record<FilterCategory, number>;
  }, [documents]);

  // Filter documents by selected category
  const filteredDocuments = useMemo(() => {
    if (selectedCategory === 'All Knowledge') {
      return documents;
    }
    return documents.filter((doc) => doc.category === selectedCategory);
  }, [documents, selectedCategory]);

  // Handle deletion
  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    setIsDeleting(true);
    try {
      await deleteDocument(deletingDoc);
      setDocuments((prev) => prev.filter((d) => d.id !== deletingDoc.id));
      setContents((prev) => {
        const next = { ...prev };
        delete next[deletingDoc.id];
        return next;
      });
      setDeletingDoc(null);
    } catch (err) {
      console.error('Delete document failed:', err);
      alert('Unable to delete this document. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 bg-grid-pattern pb-16">
      {/* 1. Futuristic Navbar */}
      <Navbar />

      {/* 2. Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 border-b border-slate-800/80">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Your Documents
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage the knowledge you&apos;ve added to MemorySpace.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadDocuments}
              disabled={loading}
              className="p-2.5 rounded-xl glass-panel text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              id="add-document-btn"
              onClick={() => navigate('/documents/add')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-[0_0_20px_rgba(56,189,248,0.25)] hover:shadow-[0_0_30px_rgba(56,189,248,0.4)] transition-all duration-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Document</span>
            </button>
          </div>
        </div>

        {/* Layout Grid: Sidebar + Documents List */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mt-8">
          {/* Left Category Sidebar */}
          <aside className="md:col-span-1">
            <div className="glass-panel rounded-2xl p-4 border border-slate-700/60 sticky top-24">
              <div className="flex items-center gap-2 mb-3 px-2 text-xs font-mono uppercase tracking-wider text-slate-400">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                <span>Categories</span>
              </div>

              <CategoryFilter
                active={selectedCategory}
                counts={categoryCounts}
                onChange={(cat) => {
                  setSelectedCategory(cat);
                  if (cat === 'All Knowledge') {
                    setSearchParams({});
                  } else {
                    setSearchParams({ category: cat });
                  }
                }}
              />
            </div>
          </aside>

          {/* Right Document List Area */}
          <section className="md:col-span-3 min-w-0">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{error}</span>
                <button
                  onClick={loadDocuments}
                  className="px-3 py-1 text-xs rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                <p className="text-slate-400 text-sm font-mono tracking-wider">
                  Loading your documents...
                </p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              /* Empty State */
              <div className="glass-panel rounded-2xl border border-slate-700/60 p-8">
                <EmptyDocumentsState category={selectedCategory} />
              </div>
            ) : (
              /* Document Cards List */
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
                  <span>
                    Showing {filteredDocuments.length}{' '}
                    {filteredDocuments.length === 1 ? 'file' : 'files'} in &ldquo;{selectedCategory}&rdquo;
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {filteredDocuments.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      content={contents[doc.id]}
                      onDelete={(d) => setDeletingDoc(d)}
                      onViewContent={(d) => setViewingDoc(d)}
                      onReprocess={handleReprocess}
                      isReprocessing={reprocessingDocId === doc.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deletingDoc && (
        <DeleteConfirmModal
          doc={deletingDoc}
          deleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingDoc(null)}
        />
      )}

      {/* Extracted Text Modal */}
      {viewingDoc && (
        <ExtractedTextModal
          doc={viewingDoc}
          content={contents[viewingDoc.id]}
          onClose={() => setViewingDoc(null)}
          onReprocess={handleReprocess}
          isReprocessing={reprocessingDocId === viewingDoc.id}
        />
      )}
    </div>
  );
}
