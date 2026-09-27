import { useState, useCallback, useRef, useEffect, FormEvent } from 'react';
import { Navbar } from '../components/Navbar';
import {
  fetchConversations,
  fetchConversationMessages,
  deleteConversation,
  sendChatMessage,
  Conversation,
} from '../services/conversationService';
import {
  fetchInsights,
  generateInsights,
  KnowledgeInsight,
} from '../services/insightService';
import { openDocument } from '../services/documentService';
import {
  Brain,
  Sparkles,
  Send,
  Database,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  RefreshCw,
  MessageSquare,
  BookOpen,
  Search,
  ArrowRight,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  GraduationCap,
  X,
  CheckCircle2,
  Clock,
  History,
} from 'lucide-react';

// ── Suggested questions ────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'What HTML elements are used to create a semantic web page?',
  'Why are semantic HTML tags useful for accessibility and SEO?',
  'What is the structure of an HTML5 document?',
  'Explain how forms and input elements work in HTML5',
  'What are the key concepts of web development?',
];

// ── Source Chip ───────────────────────────────────────────────────────────────

interface SourceItem {
  id?: string;
  chunk_id?: string | null;
  document_id?: string | null;
  filename: string;
  chunk_index: number;
  similarity: number;
  category?: string;
  file_type?: string;
  content_snippet?: string;
  content?: string;
}

function SourceCard({ source, index }: { source: SourceItem; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const [isOpening, setIsOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpening || !source.document_id) return;
    setIsOpening(true);
    setOpenError(null);
    try {
      await openDocument(source.document_id);
    } catch (err) {
      console.error('[SourceCard] Failed to open document:', err);
      setOpenError('Unable to open this document.');
    } finally {
      setIsOpening(false);
    }
  };

  const simPct = Math.round((source.similarity || 0) * 100);
  const badgeColor =
    simPct >= 80
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40'
      : simPct >= 60
      ? 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40'
      : 'text-amber-400 border-amber-500/30 bg-amber-950/30';

  const textContent = source.content || source.content_snippet || '';

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 overflow-hidden hover:border-indigo-500/40 transition-all">
      <div
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 p-3 text-left cursor-pointer hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-1.5 py-0.5 rounded shrink-0">
            #{index + 1}
          </span>
          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-200 truncate">{source.filename}</span>
          <span className="text-[10px] text-slate-500 font-mono shrink-0">chunk #{(source.chunk_index ?? 0) + 1}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
            {simPct}% match
          </span>

          {source.document_id && (
            <button
              type="button"
              onClick={handleOpen}
              disabled={isOpening}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/40 text-[11px] font-medium text-indigo-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title={`Open ${source.filename}`}
            >
              {isOpening ? (
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
          )}

          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-800/80 pt-3 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3 h-3" />
              <span>{source.category || 'Documents'} · {source.file_type?.toUpperCase() || 'PDF/TEXT'} · public.document_chunks</span>
            </span>
          </div>

          {textContent && (
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-950/60 rounded-lg p-3 border border-slate-800 font-sans">
              {textContent}
            </p>
          )}

          {source.document_id && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleOpen}
                disabled={isOpening}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-xs font-semibold text-indigo-200 hover:text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isOpening ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Opening...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Document</span>
                  </>
                )}
              </button>

              {openError && (
                <span className="text-[11px] font-mono text-rose-400">
                  {openError}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Message Render (User or Assistant) ────────────────────────────────────────

function MessageBubble({
  message,
}: {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: SourceItem[];
    grounded?: boolean;
    created_at?: string;
  };
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-3 mb-6">
        <div className="max-w-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl rounded-tr-sm px-5 py-3 shadow-[0_4px_20px_rgba(99,102,241,0.25)] border border-indigo-400/30">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-300">
          <MessageSquare className="w-4 h-4" />
        </div>
      </div>
    );
  }

  // Assistant bubble
  const sources = message.sources || [];
  const hasNoEvidence = sources.length === 0;

  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center shrink-0 text-white shadow-[0_0_15px_rgba(56,189,248,0.3)]">
        <Brain className="w-4 h-4" />
      </div>

      <div className="flex-1 glass-panel rounded-2xl rounded-tl-sm border border-slate-700/60 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-mono font-semibold text-cyan-300 uppercase tracking-wider">
            MemorySpace AI
          </span>
          {hasNoEvidence ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-400">
              no direct evidence found
            </span>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
              grounded in documents
            </span>
          )}
        </div>

        {/* Answer text */}
        <div className="text-sm text-slate-200 leading-relaxed space-y-2">
          {message.content.split('\n').map((line, i) => {
            const trimLine = line.trim();
            if (!trimLine) return null;
            if (trimLine.startsWith('* ') || trimLine.startsWith('- ')) {
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1 shrink-0">•</span>
                  <span>{trimLine.replace(/^[*-]\s+/, '')}</span>
                </div>
              );
            }
            if (/^\d+\.\s/.test(trimLine)) {
              const num = trimLine.match(/^(\d+)\./)?.[1];
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-indigo-400 font-mono text-xs mt-0.5 shrink-0 w-4">{num}.</span>
                  <span>{trimLine.replace(/^\d+\.\s+/, '')}</span>
                </div>
              );
            }
            if (trimLine.startsWith('## ') || (trimLine.startsWith('**') && trimLine.endsWith('**'))) {
              return (
                <p key={i} className="font-semibold text-white mt-3">
                  {trimLine.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
                </p>
              );
            }
            return <p key={i}>{trimLine}</p>;
          })}
        </div>

        {/* Sources Accordion */}
        {sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800/60">
            <button
              type="button"
              onClick={() => setSourcesOpen((o) => !o)}
              className="flex items-center gap-2 text-[11px] font-mono text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>{sourcesOpen ? 'Hide' : 'View'} {sources.length} cited source{sources.length !== 1 ? 's' : ''}</span>
              {sourcesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {sourcesOpen && (
              <div className="mt-3 space-y-2">
                {sources.map((src, i) => (
                  <SourceCard key={src.id || src.chunk_id || i} source={src} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main AIAssistant Page ─────────────────────────────────────────────────────

export const AIAssistant = () => {
  // Multi-turn Conversation State (Phase 8A + 8B)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      sources?: SourceItem[];
      grounded?: boolean;
      created_at?: string;
    }>
  >([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Chat input and execution state
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Study Insights & Knowledge Gaps Modal (Phase 8F)
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [insights, setInsights] = useState<KnowledgeInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [studyGoalInput, setStudyGoalInput] = useState('');
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // 1. Initial Load: Fetch conversations
  const loadConversations = useCallback(async () => {
    try {
      const list = await fetchConversations();
      setConversations(list);
      if (list.length > 0 && !activeConvId) {
        // Auto-select latest conversation
        setActiveConvId(list[0].id);
      }
    } catch (err) {
      console.warn('Could not load conversations:', err);
    }
  }, [activeConvId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 2. Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    const loadMessages = async () => {
      try {
        const msgs = await fetchConversationMessages(activeConvId);
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            grounded: m.grounded,
            created_at: m.created_at,
            sources: (m.sources || []).map((s) => ({
              id: s.id,
              chunk_id: s.chunk_id,
              document_id: s.document_id,
              filename: s.filename,
              chunk_index: s.chunk_index,
              similarity: s.similarity,
              content_snippet: s.content_snippet,
            })),
          }))
        );
      } catch (err) {
        console.error('Failed to load conversation messages:', err);
      }
    };
    loadMessages();
  }, [activeConvId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messages, isLoading]);

  // 3. Start a new conversation
  const handleStartNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setIsSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // 4. Delete a conversation
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // 5. Send message (Multi-turn RAG)
  const submitMessage = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || isLoading) return;

      setQuery('');
      setIsLoading(true);
      setError(null);

      // Optimistic user bubble
      const tempUserId = `user-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tempUserId,
          role: 'user',
          content: clean,
          created_at: new Date().toISOString(),
        },
      ]);

      try {
        const response = await sendChatMessage(clean, activeConvId || undefined);

        // Update active conversation ID if this was a new thread
        if (response.conversation_id && response.conversation_id !== activeConvId) {
          setActiveConvId(response.conversation_id);
          // Refresh conversation list to get new thread title
          fetchConversations().then(setConversations);
        }

        // Append assistant response
        setMessages((prev) => [
          ...prev,
          {
            id: response.message_id || `asst-${Date.now()}`,
            role: 'assistant',
            content: response.answer,
            grounded: response.grounded,
            sources: response.sources,
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'AI assistant encountered an error.';
        console.error('Chat error:', msg);
        setError(msg);
      } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [activeConvId, isLoading]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitMessage(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage(query);
    }
  };

  // 6. Study Insights & Knowledge Gaps Handlers (Phase 8F)
  const handleOpenInsights = async () => {
    setShowInsightsModal(true);
    setInsightsError(null);
    if (insights.length === 0) {
      try {
        const existing = await fetchInsights();
        setInsights(existing);
      } catch (err) {
        console.warn('Could not fetch existing insights:', err);
      }
    }
  };

  const handleRunAnalysis = async (goalToRun?: string) => {
    const goal = goalToRun !== undefined ? goalToRun : studyGoalInput;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const results = await generateInsights(goal);
      setInsights(results);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed. Please check your documents.';
      setInsightsError(msg);
    } finally {
      setInsightsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 bg-grid-pattern relative overflow-x-hidden">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 pt-24 sm:pt-28 pb-56">
        {/* ── Top Header with Actions ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-mono tracking-wider mb-2">
              <Brain className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>PHASE 8: KNOWLEDGE INTELLIGENCE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Ask <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">MemorySpace AI</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Multi-turn grounded dialogue · Automatic concept extraction · Objective study gap analysis
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartNewChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSidebarOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
              title="Chat History"
            >
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>History ({conversations.length})</span>
            </button>

            <button
              type="button"
              onClick={handleOpenInsights}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/40 hover:bg-purple-900/60 text-purple-200 text-xs font-semibold shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all cursor-pointer"
            >
              <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
              <span>Study Insights</span>
            </button>
          </div>
        </div>

        {/* ── Active Conversation Indicator ── */}
        {activeConvId && (
          <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono text-slate-400 mb-6">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium truncate">
                {conversations.find((c) => c.id === activeConvId)?.title || 'Active Conversation'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleStartNewChat}
              className="text-[11px] text-cyan-400 hover:underline cursor-pointer shrink-0 ml-2"
            >
              Start New
            </button>
          </div>
        )}

        {/* ── Empty State / Suggested Questions ── */}
        {messages.length === 0 && !isLoading && (
          <div className="mb-8">
            <div className="glass-panel rounded-2xl border border-slate-800 p-6 text-center mb-6">
              <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-3 animate-pulse" />
              <h3 className="text-base font-semibold text-white mb-1">
                Personalized Knowledge Assistant
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                Ask multi-turn questions about your uploaded documents. Follow up naturally — MemorySpace remembers conversation context and grounds answers strictly in your study material.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono text-slate-500">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">gemini-embedding-001 (768d)</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">pgvector cosine search</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">gemini-3.8-flash RAG</span>
              </div>
            </div>

            <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3 text-center">
              Try asking about your study material:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => submitMessage(q)}
                  className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/60 hover:border-indigo-500/40 hover:bg-indigo-950/20 text-left transition-all cursor-pointer"
                >
                  <Search className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 shrink-0 transition-colors" />
                  <span className="text-xs text-slate-300 group-hover:text-white transition-colors">{q}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 ml-auto shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Message Thread ── */}
        <div className="space-y-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>

        {/* ── Thinking / Loading Indicator ── */}
        {isLoading && (
          <div className="glass-panel rounded-2xl border border-indigo-500/30 p-5 mt-4 flex items-center gap-4 shadow-[0_0_30px_rgba(99,102,241,0.15)]">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">MemorySpace AI is retrieving evidence & reasoning...</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Query reformulation → pgvector similarity → Gemini Flash grounded generation
              </p>
            </div>
          </div>
        )}

        {/* ── Error Banner ── */}
        {error && !isLoading && (
          <div className="glass-panel rounded-2xl border border-red-500/40 p-4 mt-4 flex items-start gap-3 shadow-[0_0_25px_rgba(239,68,68,0.15)]">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white mb-0.5">Unable to complete request</p>
              <p className="text-xs text-red-300 font-mono">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="mt-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── Conversation History Drawer (Right / Side) ── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-sm h-full bg-slate-900 border-l border-slate-800 p-5 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Saved Conversations</h3>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleStartNewChat}
              className="mt-4 mb-4 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Start New Conversation</span>
            </button>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {conversations.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  No saved conversations yet.
                </p>
              ) : (
                conversations.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setActiveConvId(conv.id);
                        setIsSidebarOpen(false);
                      }}
                      className={`group flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isActive
                          ? 'bg-indigo-950/60 border-indigo-500/50 text-white'
                          : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="text-xs font-medium truncate">{conv.title}</p>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {new Date(conv.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Study Insights & Knowledge Gaps Modal (Phase 8F) ── */}
      {showInsightsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel-elevated rounded-2xl border border-purple-500/40 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Study Insights & Knowledge Gaps</h3>
                  <p className="text-xs text-slate-400">Objective analysis of your uploaded document library coverage</p>
                </div>
              </div>
              <button
                onClick={() => setShowInsightsModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {/* Study Goal Formulation Input */}
              <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4">
                <label className="block text-xs font-mono text-purple-300 mb-2">
                  Target Study Goal / Exam Topic:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={studyGoalInput}
                    onChange={(e) => setStudyGoalInput(e.target.value)}
                    placeholder="e.g. Web Development Exam, OS Scheduling & Memory..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={() => handleRunAnalysis()}
                    disabled={insightsLoading}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {insightsLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Analyze</span>
                  </button>
                </div>

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {['Web Development', 'Semantic HTML & Layout', 'General Study Mastery'].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => {
                        setStudyGoalInput(chip);
                        handleRunAnalysis(chip);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-[10px] text-slate-400 hover:text-purple-200 transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error feedback */}
              {insightsError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{insightsError}</span>
                </div>
              )}

              {/* Insights Results */}
              {insights.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Library Coverage Breakdown:
                  </h4>
                  {insights.map((item, idx) => {
                    const isCovered = item.insight_type === 'well_covered';
                    const isLight = item.insight_type === 'lightly_covered';
                    const isGap = item.insight_type === 'gap';

                    const border = isCovered
                      ? 'border-emerald-500/40 bg-emerald-950/20'
                      : isLight
                      ? 'border-amber-500/40 bg-amber-950/20'
                      : isGap
                      ? 'border-rose-500/40 bg-rose-950/20'
                      : 'border-indigo-500/40 bg-indigo-950/20';

                    const badge = isCovered
                      ? { label: 'WELL COVERED', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/60', icon: CheckCircle2 }
                      : isLight
                      ? { label: 'LIGHT COVERAGE', color: 'text-amber-400 border-amber-500/40 bg-amber-950/60', icon: Clock }
                      : isGap
                      ? { label: 'KNOWLEDGE GAP', color: 'text-rose-400 border-rose-500/40 bg-rose-950/60', icon: AlertCircle }
                      : { label: 'RECOMMENDATION', color: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/60', icon: Sparkles };

                    const Icon = badge.icon;

                    return (
                      <div
                        key={item.id || idx}
                        className={`p-4 rounded-xl border ${border} transition-all`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-white">{item.topic}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${badge.color}`}>
                            <Icon className="w-3 h-3" />
                            <span>{badge.label}</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.evidence}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                !insightsLoading && (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No insights generated yet. Click "Analyze" above to evaluate your library coverage against your study goal.
                  </div>
                )
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">
                Insights are strictly factual and objective · Phase 8F
              </span>
              <button
                onClick={() => setShowInsightsModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fixed Bottom Input Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-[#030712] via-[#030712]/95 to-transparent pt-8 pb-6 px-4">
        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="glass-panel-elevated rounded-2xl p-3 border border-indigo-500/30 shadow-[0_-4px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(99,102,241,0.12)] flex items-end gap-3"
          >
            <div className="flex-1 flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-400/80 ml-2 shrink-0 mb-1" />
              <textarea
                id="ai-assistant-input"
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything or follow up on your study material… (Enter to send, Shift+Enter for newline)"
                rows={1}
                style={{ resize: 'none', minHeight: '2.5rem', maxHeight: '8rem' }}
                className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none py-2 leading-snug overflow-y-auto"
                autoFocus
                onInput={(e) => {
                  const target = e.currentTarget;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                }}
              />
            </div>

            <button
              id="ai-assistant-submit"
              type="submit"
              disabled={isLoading || !query.trim()}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] active:scale-90 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mb-0.5"
              title="Send question"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>

          <p className="text-center text-[10px] text-slate-600 font-mono mt-2">
            Multi-turn conversation · Powered by Gemini Flash + pgvector RAG · Document citations with 1-click open
          </p>
        </div>
      </div>
    </div>
  );
};
