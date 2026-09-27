import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { KnowledgeScene } from '../components/KnowledgeScene';
import { NodeDetailModal } from '../components/NodeDetailModal';
import { SearchBox } from '../components/SearchBox';
import { SearchResult } from '../components/SearchResult';
import { fetchDocuments, searchDocumentsLocally, getDocumentUrl } from '../services/documentService';
import { buildKnowledgeGraph, GraphNodeItem } from '../services/graphService';
import { KnowledgeTopic } from '../services/topicService';
import { computeCategoryCounts, getDisplayFilename } from '../services/categoryService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Document, DocumentCategory } from '../types/document';
import { RotateCcw, AlertCircle, RefreshCw, Compass, PlusCircle, Sparkles, X, Filter } from 'lucide-react';

export const KnowledgeGraph = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // ── Category filter from URL search params or local state ─────────────────
  const categoryParam = searchParams.get('category');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    categoryParam || 'All Knowledge'
  );

  // Sync state if URL search param changes
  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    } else {
      setSelectedCategory('All Knowledge');
    }
  }, [categoryParam]);

  // ── Real User Documents & Topics from Supabase (Strictly Scoped to auth.uid()) ──
  const [userDocs, setUserDocs] = useState<Document[]>([]);
  const [topics, setTopics] = useState<KnowledgeTopic[]>([]);
  const [docTopics, setDocTopics] = useState<Array<{ document_id: string; topic_id: string }>>([]);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 3D Graph Node & Selection State ───────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<GraphNodeItem | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [searchResultDoc, setSearchResultDoc] = useState<Document | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchNotFoundMsg, setSearchNotFoundMsg] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  // ── Fetch authenticated user's real documents and topics from Supabase ────
  const loadUserDocuments = useCallback(async () => {
    if (!user) {
      setUserDocs([]);
      setTopics([]);
      setDocTopics([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch user's real documents
      const docs = await fetchDocuments(user.id);
      setUserDocs(docs);

      if (docs.length === 0) {
        setTopics([]);
        setDocTopics([]);
        setLoading(false);
        return;
      }

      const docIds = docs.map((d) => d.id);

      // 2. Fetch document_topics ONLY for this user's documents
      const { data: dtData, error: dtErr } = await supabase
        .from('document_topics')
        .select('document_id, topic_id')
        .in('document_id', docIds);

      if (dtErr) {
        console.warn('Could not load document_topics for user:', dtErr);
      }

      const validDocTopics = dtData || [];
      setDocTopics(validDocTopics);

      // 3. Fetch knowledge_topics ONLY linked to this user's documents
      const topicIds = Array.from(new Set(validDocTopics.map((dt) => dt.topic_id)));

      if (topicIds.length > 0) {
        const { data: topicsData, error: tErr } = await supabase
          .from('knowledge_topics')
          .select('*')
          .in('id', topicIds)
          .order('name', { ascending: true });

        if (tErr) {
          console.warn('Could not load knowledge_topics for user:', tErr);
          setTopics([]);
        } else {
          setTopics(topicsData || []);
        }
      } else {
        setTopics([]);
      }
    } catch (err: unknown) {
      console.warn('Could not load user documents for Knowledge Graph:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load your Knowledge Graph. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserDocuments();
  }, [loadUserDocuments]);

  // ── Build 3D Knowledge Graph Hierarchy: MemorySpace -> Category -> Document ──
  const graphNodes = useMemo(() => {
    return buildKnowledgeGraph(userDocs, topics, docTopics, {
      selectedCategory,
      expandedDocId,
    });
  }, [userDocs, topics, docTopics, selectedCategory, expandedDocId]);

  // ── Real Category Counts strictly derived from userDocs ───────────────────
  const categoryCounts = useMemo(() => {
    return computeCategoryCounts(userDocs);
  }, [userDocs]);

  // ── Real Document Search Handler ──────────────────────────────────────────
  const handleSearch = useCallback(
    (query: string) => {
      const cleanQ = query.trim();
      setLastSearchQuery(cleanQ);
      if (!cleanQ) {
        setSearchResultDoc(null);
        setSearchNotFoundMsg(null);
        setSelectedNode(null);
        setHighlightedNodeIds([]);
        return;
      }

      setIsSearching(true);
      setSearchNotFoundMsg(null);

      setTimeout(() => {
        setIsSearching(false);
        const matches = searchDocumentsLocally(userDocs, cleanQ);

        if (matches.length > 0) {
          const matchedDoc = matches[0];
          setSearchResultDoc(matchedDoc);
          setSearchNotFoundMsg(null);
          setExpandedDocId(matchedDoc.id);

          // Find corresponding 3D graph node
          const targetNode = graphNodes.find((n) => n.id === `doc-${matchedDoc.id}`);
          if (targetNode) {
            setSelectedNode(targetNode);
            setHighlightedNodeIds([targetNode.id, ...targetNode.related]);
          }
        } else {
          setSearchResultDoc(null);
          setSelectedNode(null);
          setHighlightedNodeIds([]);
          setSearchNotFoundMsg(`No filename/category matching "${cleanQ}" found in graph.`);
        }
      }, 300);
    },
    [userDocs, graphNodes],
  );

  // ── Clear Search Handler ─────────────────────────────────────────────────
  const handleClearSearch = useCallback(() => {
    setSearchResultDoc(null);
    setSearchNotFoundMsg(null);
    setSelectedNode(null);
    setExpandedDocId(null);
    setHighlightedNodeIds([]);
  }, []);

  // ── Handle Direct Node Selection from 3D Canvas ──────────────────────────
  const handleSelectNode = useCallback((node: GraphNodeItem | null) => {
    setSelectedNode(node);
    if (!node) {
      setHighlightedNodeIds([]);
      setSearchResultDoc(null);
      return;
    }

    if (node.isCategoryNode) {
      // Category node clicked: highlight category and its child documents!
      setSearchResultDoc(null);
      setHighlightedNodeIds([node.id, ...node.related]);
    } else if (node.realDoc) {
      // Document node clicked: show document info modal & highlight parent category
      setSearchResultDoc(node.realDoc);
      setHighlightedNodeIds([node.id, ...node.related]);
    } else if (node.isRootNode) {
      // Root MemorySpace clicked: highlight category hubs
      setSearchResultDoc(null);
      setHighlightedNodeIds([node.id, ...node.related]);
    } else {
      setSearchResultDoc(null);
      setHighlightedNodeIds([node.id, ...node.related]);
    }
  }, []);

  // ── Handle Selecting Related Node from Modal ──────────────────────────────
  const handleSelectRelatedById = useCallback(
    (id: string) => {
      const target = graphNodes.find((n) => n.id === id);
      if (target) {
        setSelectedNode(target);
        setHighlightedNodeIds([target.id, ...target.related]);
        if (target.realDoc) {
          setSearchResultDoc(target.realDoc);
        } else {
          setSearchResultDoc(null);
        }
      }
    },
    [graphNodes],
  );

  // ── Reset Universe Camera Perspective & Graph State ───────────────────────
  const handleResetUniverse = useCallback(() => {
    setSelectedNode(null);
    setExpandedDocId(null);
    setHighlightedNodeIds([]);
    setSearchResultDoc(null);
    setSearchNotFoundMsg(null);
    setSelectedCategory('All Knowledge');
    setSearchParams({});
  }, [setSearchParams]);

  // ── Category Filter Click Handler ─────────────────────────────────────────
  const handleFilterCategory = (catName: string) => {
    setSelectedCategory(catName);
    setSelectedNode(null);
    setHighlightedNodeIds([]);
    setSearchResultDoc(null);
    if (catName === 'All Knowledge') {
      setSearchParams({});
    } else {
      setSearchParams({ category: catName });
    }
  };

  // ── Handle Opening Real Document ─────────────────────────────────────────
  const handleOpenRealDoc = async (doc: Document) => {
    try {
      const url = await getDocumentUrl(doc.storage_path);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      console.error('Failed to open document from graph:', err);
      alert('Could not open file. Please try again.');
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#030712] select-none text-slate-100 bg-grid-pattern">
      {/* 1. Futuristic Navbar */}
      <Navbar onResetView={handleResetUniverse} />

      {/* 2. Fullscreen Interactive 3D Knowledge Universe Canvas */}
      <KnowledgeScene
        nodes={graphNodes}
        selectedNodeId={selectedNode ? selectedNode.id : null}
        highlightedNodeIds={highlightedNodeIds}
        onSelectNode={handleSelectNode}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md pointer-events-auto">
          <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-3" />
          <p className="text-slate-300 text-xs font-mono tracking-wider">
            Constructing 3D Knowledge Universe...
          </p>
        </div>
      )}

      {/* Error Overlay */}
      {!loading && error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 backdrop-blur-md pointer-events-auto p-4">
          <div className="glass-panel rounded-2xl border border-red-500/30 p-6 text-center max-w-md">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-3 text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              Failed to load Knowledge Graph
            </h3>
            <p className="text-xs text-slate-400 mb-4">{error}</p>
            <button
              onClick={loadUserDocuments}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Category Filter Bar (Section 15: Reusable across Documents & Graph) */}
      {!loading && !error && userDocs.length > 0 && (
        <div className="fixed top-20 left-6 z-20 pointer-events-auto hidden sm:flex items-center gap-1.5 p-1 rounded-2xl glass-panel-elevated border border-slate-700/60 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <div className="px-2.5 py-1 flex items-center gap-1 text-[11px] font-mono text-slate-400">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Category:</span>
          </div>
          {(
            [
              'All Knowledge',
              'Documents',
              'Notes',
              'Code',
              'Images',
              'Assignments',
            ] as const
          ).map((catName) => {
            const isActive = selectedCategory === catName;
            const count = categoryCounts[catName] ?? 0;
            return (
              <button
                key={catName}
                onClick={() => handleFilterCategory(catName)}
                className={`px-3 py-1 text-xs rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <span>{catName}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-cyan-950/80 text-cyan-300'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Empty State (When authenticated user has 0 uploaded documents) */}
      {!loading && !error && userDocs.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none p-4">
          <div className="pointer-events-auto glass-panel-elevated rounded-2xl p-8 border border-cyan-500/30 text-center max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/50 border border-cyan-500/40 flex items-center justify-center mx-auto mb-4 text-cyan-400 shadow-[0_0_30px_rgba(56,189,248,0.25)]">
              <Compass className="w-8 h-8 text-cyan-400 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              No documents in your MemorySpace yet.
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Upload your first document to start building your knowledge graph.
            </p>
            <button
              onClick={() => navigate('/documents/add')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-[0_0_20px_rgba(56,189,248,0.25)] transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add Document</span>
            </button>
          </div>
        </div>
      )}

      {/* Search Not Found Banner */}
      {searchNotFoundMsg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-auto glass-panel-elevated rounded-2xl px-5 py-3 border border-cyan-500/40 bg-slate-950/95 text-xs text-slate-200 flex flex-col sm:flex-row items-center gap-3 shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(56,189,248,0.2)]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{searchNotFoundMsg}</span>
          </div>
          <button
            onClick={() => navigate(`/search?q=${encodeURIComponent(lastSearchQuery)}`)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-[0_0_12px_rgba(56,189,248,0.35)]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Search Meaning with Semantic AI Search →</span>
          </button>
          <button
            onClick={() => setSearchNotFoundMsg(null)}
            className="text-slate-400 hover:text-white cursor-pointer ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. Real Search Result Panel HUD */}
      {searchResultDoc && (
        <SearchResult
          resultDoc={searchResultDoc}
          onClose={() => setSearchResultDoc(null)}
          onOpenDocument={handleOpenRealDoc}
          onFocusNode={() => {
            const node = graphNodes.find((n) => n.id === `doc-${searchResultDoc.id}`);
            if (node) setSelectedNode(node);
          }}
        />
      )}

      {/* 5. Node Detail Info Modal (When user selects any node) */}
      {selectedNode && !searchResultDoc && (
        <NodeDetailModal
          node={selectedNode}
          allNodes={graphNodes}
          onClose={() => {
            setSelectedNode(null);
          }}
          onSelectRelated={handleSelectRelatedById}
          onFilterCategory={handleFilterCategory}
        />
      )}

      {/* 6. Persistent Search Box in RIGHT-BOTTOM Position */}
      <SearchBox
        onSearch={handleSearch}
        onClear={handleClearSearch}
        isSearching={isSearching}
        hint={userDocs.length > 0 ? getDisplayFilename(userDocs[0].filename) : 'Search graph'}
        placeholder="Search documents in graph..."
      />

      {/* 7. Bottom Universe Controls & Telemetry */}
      {!loading && !error && userDocs.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-3">
          <div className="pointer-events-auto px-4 py-2 rounded-full glass-panel border border-slate-700/60 shadow-lg flex items-center gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono text-slate-300">
                {graphNodes.length} Graph {graphNodes.length === 1 ? 'Node' : 'Nodes'} ({userDocs.length} {userDocs.length === 1 ? 'Document' : 'Documents'})
              </span>
            </div>

            <span className="text-slate-600">|</span>

            <span className="font-mono text-[11px] hidden sm:inline text-slate-400">
              Rotate: Drag • Zoom: Scroll • Inspect: Click Node
            </span>

            <button
              onClick={handleResetUniverse}
              className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors ml-1 cursor-pointer"
              title="Reset Universe Perspective"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
