import { useState, useRef, ChangeEvent, DragEvent, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import {
  UploadCloud,
  FileCode,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  suggestCategory,
  getFileTypeLabel,
  formatFileSize,
  validateFile,
  ACCEPTED_EXTENSIONS,
} from '../services/categoryService';
import { uploadDocument } from '../services/documentService';
import { processDocumentExtraction } from '../services/extractionService';
import { triggerDocumentEmbedding } from '../services/embeddingService';
import { extractTopicsForDocument } from '../services/topicService';
import type { DocumentCategory } from '../types/document';
import { DOCUMENT_CATEGORIES } from '../types/document';

export function AddDocument() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('Documents');
  const [suggestedCategoryName, setSuggestedCategoryName] = useState<DocumentCategory | null>(null);
  const [suggestionReason, setSuggestionReason] = useState<string>('');

  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'extracting' | 'success'>('idle');

  // Process selected file
  const handleProcessFile = (file: File) => {
    setValidationError(null);
    setUploadError(null);

    const validation = validateFile(file);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid file.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);

    // Automatic category suggestion
    const suggestion = suggestCategory(file);
    setSuggestedCategoryName(suggestion.category);
    setSelectedCategory(suggestion.category);
    setSuggestionReason(suggestion.reason);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setSuggestedCategoryName(null);
    setValidationError(null);
    setUploadError(null);
    setUploadProgress(0);
    setUploadState('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit / Upload Handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) return;

    setUploadState('uploading');
    setUploadError(null);
    setUploadProgress(10);

    try {
      // 1. Upload to Supabase Storage & insert public.documents row
      const newDoc = await uploadDocument(
        selectedFile,
        {
          user_id: user.id,
          filename: selectedFile.name,
          file_type: getFileTypeLabel(selectedFile),
          mime_type: selectedFile.type || 'application/octet-stream',
          file_size: selectedFile.size,
          category: selectedCategory,
        },
        (progress) => setUploadProgress(progress)
      );

      // 2. Trigger text extraction & chunking pipeline (Phase 5A & 5B)
      setUploadState('extracting');
      try {
        await processDocumentExtraction(newDoc);
      } catch (extractErr) {
        // Safe: If extraction fails, original document is NOT deleted and remains accessible
        console.warn('Extraction completed with warning (document remains safe):', extractErr);
      }

      // 3. Trigger server-side embeddings generation (Phase 5C)
      try {
        await triggerDocumentEmbedding(newDoc.id);
      } catch (embedErr) {
        // Non-blocking: document and chunks remain completely safe
        console.warn('Embedding trigger notice (document remains safe):', embedErr);
      }

      // 4. Trigger concept & topic extraction (Phase 8C)
      try {
        await extractTopicsForDocument(newDoc.id);
      } catch (topicErr) {
        // Non-blocking: document and chunks remain completely safe
        console.warn('Topic extraction notice (document remains safe):', topicErr);
      }

      setUploadState('success');

      // Navigate back to documents after brief success feedback
      setTimeout(() => {
        navigate('/documents');
      }, 1200);
    } catch (err: unknown) {
      console.error('Upload failed:', err);
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setUploadError(msg);
      setUploadState('idle');
    }
  };

  const isBusy = uploadState === 'uploading' || uploadState === 'extracting';

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 bg-grid-pattern pb-16">
      {/* 1. Futuristic Navbar */}
      <Navbar />

      {/* 2. Main Container */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-24">
        {/* Back Link */}
        <Link
          to="/documents"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors mb-4 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Documents</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Add to your Memory
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload something you want MemorySpace to remember.
          </p>
        </div>

        {/* Notification Banners */}
        {validationError && (
          <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {uploadError && (
          <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Upload failed. Please try again.</p>
              <p className="text-xs text-red-400/80 mt-0.5">{uploadError}</p>
            </div>
          </div>
        )}

        {uploadState === 'success' && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>Your file was added and processed. Redirecting to documents…</span>
          </div>
        )}

        {/* Dropzone & File Selection Area */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`glass-panel rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300 ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_30px_rgba(56,189,248,0.25)] scale-[1.01]'
                  : 'border-slate-700/80 hover:border-cyan-500/50 hover:bg-slate-900/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileInputChange}
                accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',')}
              />

              <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4 text-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
                <UploadCloud className="w-8 h-8" />
              </div>

              <h3 className="text-base font-bold text-white mb-1">
                Drag &amp; drop your file here
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                or{' '}
                <span className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300 font-semibold">
                  Browse files
                </span>
              </p>

              {/* Supported formats list */}
              <div className="pt-4 border-t border-slate-800/80 max-w-md mx-auto">
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Supported Formats (Max 50 MB)
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-mono text-slate-300">
                  {['PDF', 'DOCX', 'PPTX', 'TXT', 'MD', 'PNG', 'JPG', 'JAVA', 'PY', 'C', 'CPP', 'JS', 'TS', 'HTML', 'CSS'].map(
                    (ext) => (
                      <span
                        key={ext}
                        className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800"
                      >
                        {ext}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Selected File Preview Card */
            <div className="glass-panel rounded-2xl border border-cyan-500/40 p-6 shadow-[0_0_30px_rgba(56,189,248,0.1)] space-y-6">
              {/* File Info Bar */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-800/80">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center flex-shrink-0 text-cyan-400">
                    {selectedFile.type.startsWith('image/') ? (
                      <ImageIcon className="w-6 h-6" />
                    ) : selectedFile.name.match(/\.(java|py|c|cpp|js|ts|html|css)$/i) ? (
                      <FileCode className="w-6 h-6" />
                    ) : (
                      <FileText className="w-6 h-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-white truncate" title={selectedFile.name}>
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {getFileTypeLabel(selectedFile)} source file • {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isBusy}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Remove file"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Automatic Category Suggestion & Manual Override */}
              <div className="space-y-4">
                {/* Suggested Category Badge */}
                {suggestedCategoryName && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200">
                    <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <div>
                      <span>
                        Suggested category:{' '}
                        <strong className="text-white font-semibold underline decoration-cyan-400">
                          {suggestedCategoryName}
                        </strong>
                      </span>
                      {suggestionReason && (
                        <p className="text-[10px] text-cyan-400/80 font-mono mt-0.5">
                          {suggestionReason}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Category Selector Dropdown */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="category-select"
                    className="block text-xs font-mono uppercase tracking-wider text-slate-400"
                  >
                    Category (Select or Override)
                  </label>
                  <div className="relative">
                    <select
                      id="category-select"
                      value={selectedCategory}
                      disabled={isBusy}
                      onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm text-slate-200 appearance-none outline-none focus:border-cyan-400 cursor-pointer bg-slate-950"
                    >
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} className="bg-slate-900 text-slate-100">
                          {cat}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Progress Bar (during upload/extraction) */}
                {isBusy && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span>
                        {uploadState === 'extracting'
                          ? 'Extracting text & analyzing document…'
                          : 'Uploading to Supabase…'}
                      </span>
                      <span>{uploadState === 'extracting' ? 'Processing' : `${uploadProgress}%`}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-300 ${
                          uploadState === 'extracting' ? 'w-full animate-pulse' : ''
                        }`}
                        style={uploadState === 'uploading' ? { width: `${uploadProgress}%` } : undefined}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isBusy}
                  className="px-4 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Remove
                </button>

                <button
                  id="submit-document-btn"
                  type="submit"
                  disabled={isBusy}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-[0_0_20px_rgba(56,189,248,0.25)] hover:shadow-[0_0_30px_rgba(56,189,248,0.4)] transition-all duration-200 flex items-center gap-2 cursor-pointer"
                >
                  {uploadState === 'uploading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : uploadState === 'extracting' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                      <span>Extracting text...</span>
                    </>
                  ) : uploadState === 'success' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>Uploaded</span>
                    </>
                  ) : (
                    <span>Add to Memory</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
