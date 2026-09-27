import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { SearchBox } from '../components/SearchBox';
import { MemoryPanel } from '../components/MemoryPanel';
import { SearchResult } from '../components/SearchResult';
import {
  fetchDocuments,
  getDocumentUrl,
  downloadDocument,
} from '../services/documentService';
import { semanticSearch } from '../services/searchService';
import type { SemanticSearchResult } from '../services/searchService';
import { useAuth } from '../context/AuthContext';
import type { Document } from '../types/document';
import type { FilterCategory } from '../components/documents/CategoryFilter';
import {
  Sparkles,
  Compass,
  ArrowRight,
  BookOpen,
  PlusCircle,
  Clock,
  HardDrive,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  ExternalLink,
  Download,
  Loader2,
  FileText,
  Code,
  Image as ImageIcon,
  FolderGit2,
  Brain,
  Layers,
  Search,
  LucideIcon,
} from 'lucide-react';

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

interface CategoryStyleConfig {
  border: string;
  bg: string;
  text: string;
  icon: LucideIcon;
  badgeBg: string;
}

const CATEGORY_STYLES: Record<string, CategoryStyleConfig> = {
  Documents:   { border: 'border-sky-500/30',    bg: 'bg-sky-500/10',    text: 'text-sky-300',    badgeBg: 'bg-sky-950/80 border-sky-500/30 text-sky-300',       icon: FileText  },
  Notes:       { border: 'border-violet-500/30', bg: 'bg-violet-500/10', text: 'text-violet-300', badgeBg: 'bg-violet-950/80 border-violet-500/30 text-violet-300', icon: BookOpen  },
  Code:        { border: 'border-emerald-500/30',bg: 'bg-emerald-500/10',text: 'text-emerald-300',badgeBg: 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300',icon: Code      },
  Images:      { border: 'border-pink-500/30',   bg: 'bg-pink-500/10',   text: 'text-pink-300',   badgeBg: 'bg-pink-950/80 border-pink-500/30 text-pink-300',       icon: ImageIcon },
  Assignments: { border: 'border-amber-500/30',  bg: 'bg-amber-500/10',  text: 'text-amber-300',  badgeBg: 'bg-amber-950/80 border-amber-500/30 text-amber-300',    icon: FolderGit2},
};

const SUMMARY_CATEGORIES: Array<{ name: FilterCategory; icon: LucideIcon; color: string }> = [
  { name: 'Documents',   icon: FileText,   color: '#38bdf8' },
  { name: 'Notes',       icon: BookOpen,   color: '#a855f7' },
  { name: 'Code',        icon: Code,       color: '#10b981' },
  { name: 'Images',      icon: ImageIcon,  color: '#ec4899' },
  { name: 'Assignments', icon: FolderGit2, color: '#f59e0b' },
];

export const Memory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Real user documents from Supabase ────────────────────────────────────
  const [userDocs, setUserDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Category filter (shared with MemoryPanel sidebar) ────────────────────
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('All Knowledge');

  // ── Semantic Search State ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResultDoc, setSearchResultDoc] = useState<Document | null>(null);

  // ── Document Action States ────────────────────────────────────────────────
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  // ── Fetch user's documents from Supabase ─────────────────────────────────
  const loadUserMemories = useCallback(async () => {
    if (!user) {
      setUserDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const docs = await fetchDocuments(user.id);
      setUserDocs(docs);
    } catch (err: unknown) {
      console.warn('Could not load user memories from Supabase:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load your memories. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserMemories();
  }, [loadUserMemories]);

  // ── Category Counts (matching Documents page) ────────────────────────────
  const categoryCounts = useMemo<Record<FilterCategory, number>>(() => {
    const counts: Record<FilterCategory, number> = {
      'All Knowledge': userDocs.length,
      Documents: 0,
      Notes: 0,
      Code: 0,
      Images: 0,
      Assignments: 0,
    };
    userDocs.forEach((doc) => {
      if (doc.category in counts) {
        counts[doc.category]++;
      }
    });
    return counts;
  }, [userDocs]);

  // ── Overview Statistics ──────────────────────────────────────────────────
  const totalSizeBytes = useMemo(() => {
    return userDocs.reduce((acc, d) => acc + (d.file_size || 0), 0);
  }, [userDocs]);

  const activeCategoriesCount = useMemo(() => {
    const set = new Set(userDocs.map((d) => d.category));
    return set.size;
  }, [userDocs]);

  const latestDocument = useMemo(() => {
    return userDocs.length > 0 ? userDocs[0] : null;
  }, [userDocs]);

  // ── Documents filtered by active category (when not searching) ───────────
  const filteredCategoryDocs = useMemo(() => {
    if (selectedCategory === 'All Knowledge') return userDocs;
    return userDocs.filter((d) => d.category === selectedCategory);
  }, [userDocs, selectedCategory]);

  // ── Semantic Search handler ──────────────────────────────────────────────
  const handleSearch = useCallback(
    async (query: string) => {
      const cleanQ = query.trim();
      if (!cleanQ) {
        setSearchQuery('');
        setSemanticResults([]);
        setSearchError(null);
        setSearchResultDoc(null);
        return;
      }

      setIsSearching(true);
      setSearchQuery(cleanQ);
      setSemanticResults([]);
      setSearchError(null);
      setSearchResultDoc(null);

      try {
        const resp = await semanticSearch(cleanQ, 8);
        setSemanticResults(resp.results);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Semantic search failed.';
        console.error('Semantic search error:', msg);
        setSearchError(msg);
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  // ── Clear Search handler ─────────────────────────────────────────────────
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSemanticResults([]);
    setSearchError(null);
    setSearchResultDoc(null);
  }, []);

  // ── Open document in new tab via signed URL ──────────────────────────────
  const handleOpenDoc = async (doc: Document, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpeningDocId(doc.id);
    setActionError(null);
    try {
      const url = await getDocumentUrl(doc.storage_path);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      console.error('Failed to open document:', err);
      setActionError({ id: doc.id, message: 'Could not open document' });
    } finally {
      setOpeningDocId(null);
    }
  };

  // ── Download document as Blob via authenticated client ───────────────────
  const handleDownloadDoc = async (doc: Document, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDownloadingDocId(doc.id);
    setActionError(null);
    try {
      await downloadDocument(doc);
    } catch (err) {
      console.error('Failed to download document:', err);
      setActionError({ id: doc.id, message: 'Download failed' });
    } finally {
      setDownloadingDocId(null);
    }
  };

  // Search input dynamic hint based on user's real documents
  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#030712] select-none text-slate-100 bg-grid-pattern relative overflow-x-hidden pb-32">
      {/* Navbar */}
      <Navbar />

      {/* Ambient glow blobs */}
      <div className="fixed top-1/4 left-1/3 w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Left sidebar — real counts, dynamic categories */}
      <MemoryPanel
        documents={userDocs}
        loading={loading}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          if (isSearchActive) {
            handleClearSearch();
          }
        }}
      />

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 relative z-10">
        {/* Page header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>NEURAL RECALL MODE ACTIVE</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-glow-cyan">
              Memory <span className="text-cyan-400">Recall</span>
            </h1>
            <button
              onClick={loadUserMemories}
              disabled={loading}
              className="p-2 rounded-xl glass-panel text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors disabled:opacity-40 cursor-pointer"
              title="Refresh memories"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
            Search across your indexed memories, lecture concepts, notes, and uploaded documents.
          </p>
        </div>

        {/* Active Search Badge (if searching) */}
        {isSearchActive && (
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono shadow-[0_0_15px_rgba(56,189,248,0.2)]">
              <Search className="w-3.5 h-3.5 text-cyan-400" />
              <span>Semantic Search: &ldquo;{searchQuery}&rdquo;</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-200">
                {isSearching ? 'Searching...' : `${semanticResults.length} result${semanticResults.length !== 1 ? 's' : ''}`}
              </span>
              <button
                onClick={handleClearSearch}
                className="ml-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Category filter active badge (when not searching) */}
        {!isSearchActive && selectedCategory !== 'All Knowledge' && (
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Filtering: {selectedCategory} ({filteredCategoryDocs.length})</span>
              <button
                onClick={() => setSelectedCategory('All Knowledge')}
                className="ml-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Clear filter"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-slate-400 text-sm font-mono tracking-wider">
              Loading your memories...
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="glass-panel rounded-2xl border border-red-500/30 p-6 mb-8 text-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-3 text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              Unable to load your memories
            </h3>
            <p className="text-xs text-slate-400 mb-4">{error}</p>
            <button
              onClick={loadUserMemories}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SEARCH RESULTS VIEW (When user has searched)
        ════════════════════════════════════════════════════════════════════ */}
        {!loading && !error && isSearchActive && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-cyan-400" />
                <span>Semantic Search Results ({isSearching ? '...' : semanticResults.length})</span>
              </h2>
              <button
                onClick={handleClearSearch}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 cursor-pointer"
              >
                <span>Back to Overview</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Searching spinner */}
            {isSearching && (
              <div className="flex items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                <p className="text-slate-400 text-sm font-mono">Searching your memories semantically...</p>
              </div>
            )}

            {/* Search error */}
            {!isSearching && searchError && (
              <div className="glass-panel rounded-xl border border-red-500/30 p-4 text-center">
                <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
                <p className="text-xs text-red-400">{searchError}</p>
              </div>
            )}

            {/* Semantic Results */}
            {!isSearching && !searchError && semanticResults.length > 0 && (
              <div className="space-y-3">
                {semanticResults.map((result, i) => {
                  const simPct = Math.round(result.similarity * 100);
                  const simColor = simPct >= 80 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40' :
                                   simPct >= 60 ? 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40' :
                                   simPct >= 40 ? 'text-amber-400 border-amber-500/30 bg-amber-950/40' :
                                                  'text-slate-400 border-slate-700/60 bg-slate-900/40';
                  const style = CATEGORY_STYLES[result.category] ?? CATEGORY_STYLES.Documents;
                  const Icon = style.icon;
                  return (
                    <div
                      key={result.chunk_id}
                      className="glass-panel rounded-xl p-4 border border-slate-700/60 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(56,189,248,0.12)] transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`shrink-0 text-[10px] font-mono uppercase px-2 py-0.5 rounded border flex items-center gap-1 ${style.badgeBg}`}>
                            <Icon className="w-2.5 h-2.5" />
                            <span>{result.category}</span>
                          </span>
                          <p className="text-sm font-semibold text-slate-200 truncate" title={result.filename}>
                            {result.filename}
                          </p>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">chunk #{result.chunk_index + 1}</span>
                        </div>
                        <div className={`shrink-0 flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${simColor}`}>
                          <Sparkles className="w-3 h-3" />
                          <span>{simPct}%</span>
                        </div>
                      </div>
                      {/* Rank badge */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] font-mono text-slate-500">#{i + 1} match</span>
                        <span className="text-[10px] text-slate-600">•</span>
                        <span className="text-[10px] font-mono uppercase text-slate-500">{result.file_type}</span>
                      </div>
                      {/* Chunk content preview */}
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
                        {result.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No results */}
            {!isSearching && !searchError && semanticResults.length === 0 && (
              <div className="glass-panel rounded-2xl border border-slate-700/60 p-10 text-center max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-slate-900/80 border border-slate-700/60 flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <Search className="w-7 h-7 text-slate-400/80" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">No relevant content found.</h3>
                <p className="text-xs text-slate-400 mb-6">
                  No chunks in your memory matched &ldquo;{searchQuery}&rdquo; semantically. Try rephrasing your query.
                </p>
                <button
                  onClick={handleClearSearch}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            NORMAL OVERVIEW VIEW (When NOT searching)
        ════════════════════════════════════════════════════════════════════ */}
        {!loading && !error && !isSearchActive && userDocs.length > 0 && (
          <>
            {/* 1. MEMORY OVERVIEW METRICS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {/* Total Memories */}
              <div className="glass-panel rounded-xl p-3.5 border border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Memories</span>
                  <Brain className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-white font-mono">{userDocs.length}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Indexed files</p>
                </div>
              </div>

              {/* Categories Represented */}
              <div className="glass-panel rounded-xl p-3.5 border border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Categories</span>
                  <Layers className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-white font-mono">{activeCategoriesCount} <span className="text-xs text-slate-500 font-normal">/ 5</span></p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Active types</p>
                </div>
              </div>

              {/* Knowledge Size */}
              <div className="glass-panel rounded-xl p-3.5 border border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Indexed Size</span>
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-white font-mono truncate">{formatSize(totalSizeBytes)}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Stored data</p>
                </div>
              </div>

              {/* Latest Recall / Activity */}
              <div className="glass-panel rounded-xl p-3.5 border border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider">Latest Activity</span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white truncate mt-1">
                    {latestDocument ? formatDate(latestDocument.uploaded_at) : 'None'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 truncate" title={latestDocument?.filename}>
                    {latestDocument ? latestDocument.filename : 'No files'}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. CATEGORY / KNOWLEDGE SUMMARY (Distribution) */}
            <div className="mb-8">
              <div className="flex items-center justify-between px-1 mb-3">
                <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Knowledge Distribution</span>
                </h2>
                <span className="text-[10px] font-mono text-slate-500">
                  Click category to filter
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {SUMMARY_CATEGORIES.map(({ name, icon: Icon }) => {
                  const count = categoryCounts[name];
                  const pct = userDocs.length > 0 ? Math.round((count / userDocs.length) * 100) : 0;
                  const isSelected = selectedCategory === name;
                  const style = CATEGORY_STYLES[name] || CATEGORY_STYLES.Documents;

                  return (
                    <button
                      key={name}
                      onClick={() => setSelectedCategory(isSelected ? 'All Knowledge' : name)}
                      className={`glass-panel rounded-xl p-3 text-left transition-all cursor-pointer relative overflow-hidden group ${
                        isSelected
                          ? 'border-cyan-500/60 shadow-[0_0_15px_rgba(56,189,248,0.2)] bg-cyan-950/40'
                          : 'border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${style.bg} ${style.border}`}>
                          <Icon className={`w-3.5 h-3.5 ${style.text}`} />
                        </div>
                        <span className="text-xs font-mono font-bold text-white">{count}</span>
                      </div>

                      <p className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors truncate">
                        {name}
                      </p>

                      <div className="mt-2 w-full bg-slate-800/80 rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                        {pct}% of total
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. RECENT MEMORIES */}
            {filteredCategoryDocs.length > 0 && (
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      {selectedCategory === 'All Knowledge'
                        ? `Recent Memories (${filteredCategoryDocs.length})`
                        : `${selectedCategory} Memories (${filteredCategoryDocs.length})`}
                    </span>
                  </h2>
                  <button
                    onClick={() => navigate('/documents')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <span>Manage in Documents</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredCategoryDocs.map((doc) => {
                    const style = CATEGORY_STYLES[doc.category] ?? CATEGORY_STYLES.Documents;
                    const Icon = style.icon;
                    const isOpening = openingDocId === doc.id;
                    const isDownloading = downloadingDocId === doc.id;
                    const hasError = actionError?.id === doc.id;

                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSearchResultDoc(doc)}
                        className="glass-panel rounded-xl p-4 border border-slate-700/60 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(56,189,248,0.15)] transition-all cursor-pointer group flex flex-col justify-between"
                      >
                        <div>
                          {/* Top row: Category & Date */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border flex items-center gap-1 ${style.badgeBg}`}>
                              <Icon className="w-2.5 h-2.5" />
                              <span>{doc.category}</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 flex-shrink-0">
                              <Clock className="w-3 h-3" />
                              {formatDate(doc.uploaded_at)}
                            </span>
                          </div>

                          {/* Filename */}
                          <p className="text-sm font-semibold text-slate-200 group-hover:text-cyan-300 truncate" title={doc.filename}>
                            {doc.filename}
                          </p>

                          {/* File meta */}
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                            <span className="uppercase">{doc.file_type}</span>
                            <span>•</span>
                            <span>{formatSize(doc.file_size)}</span>
                          </div>
                        </div>

                        {/* Inline action error */}
                        {hasError && (
                          <p className="text-[10px] text-red-400 font-mono mt-2 truncate">
                            {actionError.message}
                          </p>
                        )}

                        {/* Bottom action buttons */}
                        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-800/80">
                          <button
                            onClick={(e) => handleOpenDoc(doc, e)}
                            disabled={isOpening || isDownloading}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            title="Open file in new tab"
                          >
                            {isOpening ? (
                              <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            ) : (
                              <ExternalLink className="w-3 h-3 text-cyan-400" />
                            )}
                            <span>{isOpening ? 'Opening...' : 'Open'}</span>
                          </button>

                          <button
                            onClick={(e) => handleDownloadDoc(doc, e)}
                            disabled={isOpening || isDownloading}
                            className="py-1.5 px-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                            title="Download file"
                          >
                            {isDownloading ? (
                              <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                            ) : (
                              <Download className="w-3 h-3 text-slate-400" />
                            )}
                            <span className="hidden sm:inline">Save</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 4. EMPTY STATE — When user has 0 documents overall ─────────── */}
        {!loading && !error && userDocs.length === 0 && (
          <div className="glass-panel rounded-2xl border border-slate-700/60 p-12 text-center mb-8 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4 text-cyan-400 shadow-[0_0_30px_rgba(56,189,248,0.2)]">
              <Brain className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Your Memory Universe is Empty
            </h3>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              No documents or memories have been uploaded yet. Upload lecture notes, code, assignments, or documents to begin building your neural memory bank.
            </p>
            <button
              onClick={() => navigate('/documents/add')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-[0_0_20px_rgba(56,189,248,0.25)] hover:shadow-[0_0_30px_rgba(56,189,248,0.4)] transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add First Document</span>
            </button>
          </div>
        )}

        {/* ── 5. EMPTY CATEGORY STATE — When filtered category has 0 docs ─── */}
        {!loading && !error && !isSearchActive && userDocs.length > 0 && filteredCategoryDocs.length === 0 && (
          <div className="glass-panel rounded-2xl border border-slate-700/60 p-10 text-center mb-8 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-900/80 border border-slate-700/60 flex items-center justify-center mx-auto mb-4 text-cyan-400">
              <FolderOpen className="w-7 h-7 text-cyan-400/80" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              No {selectedCategory} Memories
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Upload a file and assign it to <strong>{selectedCategory}</strong> to see it here.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setSelectedCategory('All Knowledge')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Show All Knowledge
              </button>
              <button
                onClick={() => navigate('/documents/add')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Document</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom link to 3D Graph */}
        <div className="flex justify-center pt-4">
          <button
            onClick={() => navigate('/knowledge')}
            className="px-5 py-2.5 rounded-full glass-panel border border-cyan-500/40 shadow-lg flex items-center gap-2.5 text-xs font-semibold text-slate-200 hover:text-cyan-300 hover:border-cyan-400 transition-all cursor-pointer group"
          >
            <Compass className="w-4 h-4 text-cyan-400 group-hover:rotate-45 transition-transform" />
            <span>Explore in 3D Knowledge Graph</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </main>

      {/* Floating Search Box — bottom-right */}
      <SearchBox
        onSearch={handleSearch}
        onClear={handleClearSearch}
        isSearching={isSearching}
        hint={userDocs.length > 0 ? userDocs[0].filename : 'Search your memories...'}
        placeholder="Ask anything about your documents..."
      />

      {/* Real Search Result Panel HUD */}
      {searchResultDoc && (
        <SearchResult
          resultDoc={searchResultDoc}
          onClose={() => setSearchResultDoc(null)}
          onOpenDocument={(doc) => handleOpenDoc(doc)}
        />
      )}
    </div>
  );
};
