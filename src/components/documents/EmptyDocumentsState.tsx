import { PlusCircle, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { FilterCategory } from './CategoryFilter';

interface EmptyDocumentsStateProps {
  category: FilterCategory;
}

const MESSAGES: Record<FilterCategory, { title: string; subtitle: string }> = {
  'All Knowledge': { title: 'No documents yet', subtitle: 'Upload your first file to start building your knowledge space.' },
  Documents:      { title: 'No Documents yet', subtitle: 'Add your first document to start building your knowledge space.' },
  Notes:          { title: 'No Notes yet',      subtitle: 'Add your first note to start capturing what you learn.' },
  Code:           { title: 'No Code files yet', subtitle: 'Upload source files to keep your code organized here.' },
  Images:         { title: 'No Images yet',     subtitle: 'Upload diagrams and visuals to enrich your knowledge.' },
  Assignments:    { title: 'No Assignments yet',subtitle: 'Add assignment files to track your coursework progress.' },
};

export function EmptyDocumentsState({ category }: EmptyDocumentsStateProps) {
  const navigate = useNavigate();
  const { title, subtitle } = MESSAGES[category] ?? MESSAGES['All Knowledge'];

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-2xl bg-slate-900/60 border border-slate-700/50 flex items-center justify-center mb-5">
        <FolderOpen className="w-10 h-10 text-slate-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-300 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mb-6">{subtitle}</p>
      <button
        onClick={() => navigate('/documents/add')}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-[0_0_20px_rgba(56,189,248,0.2)] hover:shadow-[0_0_30px_rgba(56,189,248,0.35)] transition-all duration-200"
      >
        <PlusCircle className="w-4 h-4" />
        Add Document
      </button>
    </div>
  );
}
