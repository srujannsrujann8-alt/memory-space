import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, ArrowRight, CornerDownLeft, Minus } from 'lucide-react';

interface SearchBoxProps {
  onSearch: (query: string) => void;
  onClear?: () => void;
  isSearching: boolean;
  hint?: string;
  placeholder?: string;
}

export const SearchBox = ({
  onSearch,
  onClear,
  isSearching,
  hint,
  placeholder,
}: SearchBoxProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const hintExample = hint || 'Search your documents';

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setQuery(hintExample);
      onSearch(hintExample);
    } else {
      onSearch(query.trim());
    }
  };

  const handleUseHint = () => {
    setQuery(hintExample);
    onSearch(hintExample);
  };

  const handleClear = () => {
    setQuery('');
    if (onClear) {
      onClear();
    } else {
      onSearch('');
    }
  };

  // Minimized pill state
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-30 pointer-events-none">
        <button
          onClick={() => setIsMinimized(false)}
          className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-full glass-panel-elevated border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-[0_0_20px_rgba(56,189,248,0.25)] hover:shadow-[0_0_30px_rgba(56,189,248,0.45)] hover:border-cyan-400 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          title="Open Search"
        >
          <Search className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
          <span>Search Memory</span>
          <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-30 pointer-events-none max-w-lg w-[calc(100vw-2rem)] sm:w-[440px]">
      <div className="pointer-events-auto glass-panel-elevated rounded-2xl p-4 sm:p-5 border border-cyan-500/30 shadow-[0_15px_45px_rgba(0,0,0,0.7),0_0_25px_rgba(56,189,248,0.15)] transition-all duration-300 hover:border-cyan-500/50">
        {/* Header inside the floating panel */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                What do you remember?
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                SEARCH BY FILENAME, CATEGORY &amp; TYPE
              </p>
            </div>
          </div>

          {/* Minimize button */}
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="w-6 h-6 rounded-md hover:bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Minimize Search"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search input form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative group glass-input rounded-xl p-1.5 flex items-center gap-2 focus-within:border-cyan-400/80 transition-all">
            <Search className="w-4 h-4 text-cyan-400/80 ml-2 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder || 'Search by filename or category...'}
              className="w-full bg-transparent text-slate-100 placeholder-slate-400/70 text-xs sm:text-sm font-normal focus:outline-none py-1 pr-2"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded bg-slate-800/60 mr-1 transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick hint & Explore Memory Action */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleUseHint}
              className="text-[11px] text-cyan-400/90 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-500/30 truncate text-left flex items-center gap-1 cursor-pointer transition-colors max-w-[220px]"
              title={hintExample}
            >
              <span className="text-slate-400">Try:</span>
              <span className="truncate">&ldquo;{hintExample}&rdquo;</span>
              <CornerDownLeft className="w-3 h-3 opacity-60 flex-shrink-0" />
            </button>

            <button
              type="submit"
              disabled={isSearching}
              className="relative flex-shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-semibold tracking-wide flex items-center gap-1.5 shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_25px_rgba(56,189,248,0.5)] active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-60"
            >
              {isSearching ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Filtering...</span>
                </>
              ) : (
                <>
                  <span>Filter Graph</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Quick link to Phase 6 Semantic Vector Search */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono">
              Looking for concepts or questions?
            </span>
            <button
              type="button"
              onClick={() => navigate(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search')}
              className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Semantic AI Search →</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
