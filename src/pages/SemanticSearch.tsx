import { useState, useCallback, useEffect, FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { semanticSearch } from '../services/searchService';
import type { SemanticSearchResult } from '../services/searchService';
import { openDocument } from '../services/documentService';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Sparkles,
  Brain,
  Layers,
  ArrowRight,
  Database,
  Cpu,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2,
  RefreshCw,
  Compass,
  ExternalLink,
  Loader2,
} from 'lucide-react';

const SUGGESTED_QUERIES = [
  'What is CPU scheduling?',
  'How do operating systems handle processes?',
  'Explain postfix expression evaluation',
  'What is web development?',
  'How does memory management work?',
];

export const SemanticSearch = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeQuery, setActiveQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [openDocError, setOpenDocError] = useState<{ [docId: string]: string }>({});

  const handleOpenDoc = async (docId: string) => {
    if (openingDocId) return;
    setOpeningDocId(docId);
    setOpenDocError((prev) => ({ ...prev, [docId]: '' }));
    try {
      await openDocument(docId);
    } catch (err) {
      console.error('Failed to open document:', err);
      setOpenDocError((prev) => ({ ...prev, [docId]: 'Unable to open this document.' }));
    } finally {
      setOpeningDocId(null);
    }
  };

  const executeSearch = useCallback(async (searchQueryText: string) => {
    const cleanQ = searchQueryText.trim();
    if (!cleanQ) return;

    setIsSearching(true);
    setSearchError(null);
    setActiveQuery(cleanQ);
    const start = performance.now();

    try {
      const resp = await semanticSearch(cleanQ, 10);
      setResults(resp.results || []);
      setSearchDurationMs(Math.round(performance.now() - start));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Semantic search failed.';
      console.error('Semantic search error:', msg);
      setSearchError(msg);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle URL query parameter on mount or change
  useEffect(() => {
    const qFromUrl = searchParams.get('q');
    if (qFromUrl && qFromUrl !== activeQuery) {
      setQuery(qFromUrl);
      executeSearch(qFromUrl);
    }
  }, [searchParams, executeSearch, activeQuery]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchParams({ q: query.trim() });
    executeSearch(query.trim());
  };

  const handleSuggestionClick = (suggested: string) => {
    setQuery(suggested);
    setSearchParams({ q: suggested });
    executeSearch(suggested);
  };

  return (
    <div className="min-h-screen bg-[#030712] select-none text-slate-100 bg-grid-pattern relative overflow-x-hidden pb-32">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 pt-24 sm:pt-28">
        {/* Phase 6 Header Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>PHASE 6: VECTOR RETRIEVAL PIPELINE</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Semantic <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Vector Search</span>
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-xl mx-auto">
            Retrieve document chunks by natural-language meaning using Google Gemini 768-dimensional embeddings and pgvector similarity.
          </p>

          {/* Technical Pipeline Telemetry Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] font-mono text-slate-400">
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/60 flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-cyan-400" />
              <span>Model: gemini-embedding-001</span>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/60 flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>Vector: 768 Dimensions</span>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/60 flex items-center gap-1.5">
              <Database className="w-3 h-3 text-emerald-400" />
              <span>Backend: pgvector Cosine Similarity</span>
            </span>
          </div>
        </div>

        {/* Primary Search Input Card */}
        <div className="glass-panel-elevated rounded-2xl p-4 sm:p-6 border border-cyan-500/30 shadow-[0_15px_45px_rgba(0,0,0,0.7),0_0_25px_rgba(56,189,248,0.12)] mb-8">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group glass-input rounded-xl p-2 flex items-center gap-3 focus-within:border-cyan-400/80 transition-all">
              <Search className="w-5 h-5 text-cyan-400/80 ml-2 shrink-0" />
              <input
                id="semantic-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask any concept or question (e.g. 'What is CPU scheduling?')..."
                className="w-full bg-transparent text-slate-100 placeholder-slate-400/70 text-sm font-normal focus:outline-none py-1 pr-2"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    setActiveQuery('');
                    setSearchParams({});
                  }}
                  className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800/80 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              id="semantic-search-submit"
              type="submit"
              disabled={isSearching || !query.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 text-white font-semibold text-sm tracking-wide flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(56,189,248,0.35)] hover:shadow-[0_0_30px_rgba(56,189,248,0.55)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Search Meaning</span>
                </>
              )}
            </button>
          </form>

          {/* Suggested Queries Chips */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
              Try query:
            </span>
            {SUGGESTED_QUERIES.map((sq) => (
              <button
                key={sq}
                type="button"
                onClick={() => handleSuggestionClick(sq)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-cyan-300/90 border border-slate-700/50 hover:border-cyan-500/40 transition-all cursor-pointer"
              >
                &ldquo;{sq}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Search Results HUD Header */}
        {activeQuery && !isSearching && !searchError && (
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300">
                Retrieved {results.length} relevant chunk{results.length !== 1 ? 's' : ''} for &ldquo;{activeQuery}&rdquo;
              </span>
            </div>
            {searchDurationMs !== null && (
              <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{searchDurationMs}ms</span>
              </span>
            )}
          </div>
        )}

        {/* Searching Indicator */}
        {isSearching && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-slate-300 text-sm font-mono">
              Generating 768d query embedding &amp; querying pgvector...
            </p>
            <p className="text-slate-500 text-xs font-mono">
              Comparing cosine distance across your stored document chunks
            </p>
          </div>
        )}

        {/* Error Banner */}
        {!isSearching && searchError && (
          <div className="glass-panel rounded-2xl border border-red-500/40 p-6 mb-8 text-center max-w-xl mx-auto shadow-[0_0_30px_rgba(239,68,68,0.15)]">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white mb-2">Search Pipeline Notice</h3>
            <p className="text-xs text-red-300 mb-4 leading-relaxed font-mono">
              {searchError}
            </p>
            {searchError.includes('schema cache') && (
              <div className="bg-slate-900/90 rounded-xl p-3 text-left border border-slate-700/80 mb-4">
                <p className="text-[11px] text-amber-300 font-semibold mb-1">
                  Database function not found:
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed font-mono">
                  Please run the SQL script in <code className="text-cyan-300 font-mono">supabase/phase6_vector_search.sql</code> in your Supabase Dashboard SQL Editor to install the <code className="text-cyan-300 font-mono">search_document_chunks</code> RPC function.
                </p>
              </div>
            )}
            <button
              onClick={() => executeSearch(query)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Retry Search
            </button>
          </div>
        )}

        {/* Results List */}
        {!isSearching && !searchError && results.length > 0 && (
          <div className="space-y-4">
            {results.map((result, i) => {
              const simPct = Math.round(result.similarity * 100);
              const simBadgeColor =
                simPct >= 80
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40 shadow-[0_0_15px_rgba(52,211,153,0.15)]'
                  : simPct >= 60
                  ? 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40 shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                  : 'text-amber-400 border-amber-500/30 bg-amber-950/40';

              return (
                <div
                  key={result.chunk_id}
                  className="glass-panel rounded-2xl p-5 border border-slate-700/70 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(56,189,248,0.12)] transition-all"
                >
                  {/* Top Bar: Source file, category, match rank & similarity */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 flex items-center gap-1">
                        <FileText className="w-2.5 h-2.5" />
                        <span>{result.category || 'Document'}</span>
                      </span>
                      <p className="text-sm font-bold text-white truncate" title={result.filename}>
                        {result.filename}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        chunk #{result.chunk_index + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-400">
                        Rank #{i + 1}
                      </span>
                      <div className={`flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${simBadgeColor}`}>
                        <Sparkles className="w-3 h-3" />
                        <span>{simPct}% Relevance</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenDoc(result.document_id)}
                        disabled={openingDocId === result.document_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-xs font-medium text-cyan-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                        title={`Open ${result.filename}`}
                      >
                        {openingDocId === result.document_id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Opening...</span>
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-3 h-3" />
                            <span>Open Document</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Chunk Text Content */}
                  <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80">
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {result.content}
                    </p>
                  </div>

                  {/* Chunk Metadata Footer */}
                  <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-slate-500">
                    <div className="flex items-center gap-2">
                      <span>Source: public.document_chunks ({result.chunk_id.slice(0, 8)}...)</span>
                      <span className="uppercase">{result.file_type || 'text'}</span>
                    </div>
                    {openDocError[result.document_id] && (
                      <span className="text-rose-400 font-sans text-xs">
                        {openDocError[result.document_id]}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty Search Result */}
        {!isSearching && !searchError && activeQuery && results.length === 0 && (
          <div className="glass-panel rounded-2xl border border-slate-700/60 p-12 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Search className="w-7 h-7 text-slate-400/80" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Matching Chunks</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              No document chunks in your memory matched &ldquo;{activeQuery}&rdquo;. Try asking with different terminology or upload more notes.
            </p>
          </div>
        )}

        {/* First time guide / Empty State */}
        {!isSearching && !activeQuery && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3">
                <Search className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                Conceptual Search
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Matches the meaning of your query, not just exact keywords. You can ask questions in natural language.
              </p>
            </div>

            <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
              <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                Direct Chunk Retrieval
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Retrieves the exact paragraphs and chunks from your uploaded PDFs, PPTXs, and notes that contain the answer.
              </p>
            </div>

            <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                <Database className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                Strict User Isolation
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                All searches are filtered through Row Level Security (RLS) ensuring you only retrieve your own authenticated documents.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
