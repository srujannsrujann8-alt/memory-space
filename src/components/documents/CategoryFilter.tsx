import { Brain, FileText, BookOpen, Code, Image, FolderGit2, LucideIcon } from 'lucide-react';
import type { DocumentCategory } from '../../types/document';
import { DOCUMENT_CATEGORIES } from '../../types/document';

export type FilterCategory = 'All Knowledge' | DocumentCategory;

interface CategoryFilterProps {
  active: FilterCategory;
  counts: Record<FilterCategory, number>;
  onChange: (cat: FilterCategory) => void;
}

const ALL_FILTERS: FilterCategory[] = ['All Knowledge', ...DOCUMENT_CATEGORIES];

const ICONS: Record<FilterCategory, LucideIcon> = {
  'All Knowledge': Brain,
  Documents: FileText,
  Notes: BookOpen,
  Code: Code,
  Images: Image,
  Assignments: FolderGit2,
};

export function CategoryFilter({ active, counts, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-col gap-1">
      {ALL_FILTERS.map((cat) => {
        const Icon = ICONS[cat];
        const isActive = active === cat;
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left cursor-pointer ${
              isActive
                ? 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                : 'bg-slate-900/40 hover:bg-slate-800/50 border border-slate-800/60 text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span>{cat}</span>
            </div>
            <span className={`text-xs font-mono ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
              {counts[cat] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
