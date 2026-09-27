import { useState } from 'react';
import {
  Brain,
  FileText,
  BookOpen,
  Code,
  Image,
  FolderGit2,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import type { Document } from '../types/document';
import type { FilterCategory } from './documents/CategoryFilter';

// ── Types ────────────────────────────────────────────────────────────────────

interface MemoryPanelProps {
  /** Real documents fetched from Supabase for the authenticated user */
  documents: Document[];
  /** True while the initial document fetch is in-flight */
  loading: boolean;
  /** Currently active category filter */
  selectedCategory: FilterCategory;
  /** Called when user clicks a category */
  onSelectCategory: (cat: FilterCategory) => void;
}

// ── Sidebar category config ───────────────────────────────────────────────────

interface SidebarCategory {
  name: FilterCategory;
  Icon: React.ComponentType<{ className?: string }>;
}

const SIDEBAR_CATEGORIES: SidebarCategory[] = [
  { name: 'All Knowledge', Icon: Brain },
  { name: 'Documents',     Icon: FileText },
  { name: 'Notes',         Icon: BookOpen },
  { name: 'Code',          Icon: Code },
  { name: 'Images',        Icon: Image },
  { name: 'Assignments',   Icon: FolderGit2 },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const MemoryPanel = ({
  documents,
  loading,
  selectedCategory,
  onSelectCategory,
}: MemoryPanelProps) => {
  const [isOpen, setIsOpen] = useState(true);

  // Compute real counts from the authenticated user's documents.
  // These are derived from the same array used to render the main page,
  // so they stay in sync automatically after every fetch/delete.
  const counts: Record<FilterCategory, number> = {
    'All Knowledge': documents.length,
    Documents:   documents.filter((d) => d.category === 'Documents').length,
    Notes:       documents.filter((d) => d.category === 'Notes').length,
    Code:        documents.filter((d) => d.category === 'Code').length,
    Images:      documents.filter((d) => d.category === 'Images').length,
    Assignments: documents.filter((d) => d.category === 'Assignments').length,
  };

  return (
    <aside className="fixed left-4 top-24 bottom-6 z-30 pointer-events-none flex items-start">
      {/* Collapsed toggle pill */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto p-2.5 rounded-xl glass-panel text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50 shadow-xl transition-all duration-200 flex items-center gap-2 group cursor-pointer"
          title="Open Memory Space Panel"
        >
          <Brain className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-300" />
        </button>
      )}

      {/* Main glassmorphism panel */}
      {isOpen && (
        <div className="pointer-events-auto w-72 md:w-80 glass-panel rounded-2xl flex flex-col overflow-hidden border border-slate-700/60 shadow-[0_10px_40px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out">
          {/* Header */}
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">Memory Space</h2>
                <p className="text-[10px] text-cyan-400/80 font-mono">INDEXED KNOWLEDGE REPO</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-lg hover:bg-slate-800/60 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Collapse Panel"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Categories */}
          <div className="p-3.5">
            {/* Section label */}
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 px-1">
              <span>Categories</span>
              {!loading && (
                <span className="text-[10px] text-slate-500">
                  {documents.length} {documents.length === 1 ? 'file' : 'files'}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {SIDEBAR_CATEGORIES.map(({ name, Icon }) => {
                const isActive = selectedCategory === name;
                const count = counts[name];

                return (
                  <button
                    key={name}
                    onClick={() => onSelectCategory(name)}
                    className={`p-2.5 rounded-xl text-left transition-all duration-200 flex items-center justify-between text-xs cursor-pointer ${
                      isActive
                        ? 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                        : 'bg-slate-900/40 hover:bg-slate-800/50 border border-slate-800/60 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isActive ? 'text-cyan-400' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{name}</span>
                    </div>

                    {/* Count — show dash while loading to avoid flashing fake zeros */}
                    <span
                      className={`text-[11px] font-mono flex-shrink-0 ml-2 ${
                        isActive ? 'text-cyan-400' : 'text-slate-500'
                      } ${loading ? 'opacity-40' : ''}`}
                    >
                      {loading ? '—' : count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
