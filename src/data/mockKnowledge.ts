export interface KnowledgeItem {
  id: string;
  name: string;
  category: 'Data Structures' | 'Mathematics' | 'Java' | 'Operating Systems' | 'AI & ML' | 'Projects';
  position: [number, number, number];
  related: string[];
  documents: number;
  description: string;
  color: string;
  glowColor: string;
  sourceFile?: string;
  page?: number;
  confidence?: number;
  summarySnippet?: string;
}

export const MOCK_KNOWLEDGE_NODES: KnowledgeItem[] = [
  // --- Data Structures Cluster ---
  {
    id: 'data-structures',
    name: 'Data Structures',
    category: 'Data Structures',
    position: [0, 0.8, 0],
    related: ['stack', 'queue', 'linked-list', 'trees'],
    documents: 6,
    description: 'Fundamental formats for organizing, processing, retrieving and storing data efficiently.',
    color: '#38bdf8', // Cyan
    glowColor: '#0284c7',
    sourceFile: 'CS201_DataStructures_Complete.pdf',
    page: 1,
    confidence: 98,
    summarySnippet: 'Core curriculum covering linear and non-linear memory representations.'
  },
  {
    id: 'stack',
    name: 'Stack',
    category: 'Data Structures',
    position: [-2.5, 1.4, -0.6],
    related: ['data-structures', 'postfix', 'queue'],
    documents: 4,
    description: 'LIFO (Last In First Out) linear abstract data type with Push, Pop, and Peek primitives.',
    color: '#06b6d4', // Cyan dark
    glowColor: '#0891b2',
    sourceFile: 'DS_Unit2_StacksQueues.pdf',
    page: 12,
    confidence: 96,
    summarySnippet: 'Stack memory structures and call frame simulations with contiguous arrays.'
  },
  {
    id: 'postfix',
    name: 'Postfix Evaluation',
    category: 'Data Structures',
    position: [-4.2, 2.1, -1.2],
    related: ['stack'],
    documents: 2,
    description: 'Reverse Polish Notation evaluation algorithm utilizing operand stacks for linear O(n) expression parsing.',
    color: '#22d3ee', // Bright Cyan
    glowColor: '#38bdf8',
    sourceFile: 'DS_Unit2.pdf',
    page: 18,
    confidence: 94,
    summarySnippet: 'Postfix evaluation algorithm: scan tokens from left to right; push numbers; on operator, pop 2 operands and apply operator, then push result.'
  },
  {
    id: 'queue',
    name: 'Queue & Deque',
    category: 'Data Structures',
    position: [-1.8, -0.9, 0.8],
    related: ['data-structures', 'stack'],
    documents: 3,
    description: 'FIFO (First In First Out) sequential collections and double-ended buffer queues.',
    color: '#38bdf8',
    glowColor: '#0284c7',
    sourceFile: 'DS_Queues_Circular.pdf',
    page: 7,
    confidence: 91,
    summarySnippet: 'Circular queue pointers with head and tail modular arithmetic.'
  },
  {
    id: 'linked-list',
    name: 'Linked List',
    category: 'Data Structures',
    position: [-3.2, -1.6, -0.4],
    related: ['data-structures'],
    documents: 5,
    description: 'Node chains with pointer references enabling dynamic size allocation.',
    color: '#0ea5e9',
    glowColor: '#0284c7',
    sourceFile: 'DS_Pointers_Nodes.pdf',
    page: 24,
    confidence: 89,
    summarySnippet: 'Singly and doubly linked lists with pointer redirection techniques.'
  },
  {
    id: 'trees',
    name: 'Binary Search Tree',
    category: 'Data Structures',
    position: [-0.9, 2.7, 1.2],
    related: ['data-structures'],
    documents: 4,
    description: 'Hierarchical node tree where left subtree contains lesser keys and right contains greater.',
    color: '#38bdf8',
    glowColor: '#0369a1',
    sourceFile: 'DS_BalancedTrees_AVL.pdf',
    page: 42,
    confidence: 93,
    summarySnippet: 'Tree traversals: Inorder, Preorder, Postorder, and balancing rotations.'
  },

  // --- Mathematics Cluster ---
  {
    id: 'mathematics',
    name: 'Mathematics',
    category: 'Mathematics',
    position: [3.4, 0.2, -1.5],
    related: ['laplace', 'linear-algebra', 'fourier'],
    documents: 5,
    description: 'Applied engineering mathematics, continuous transform calculus, and vector spaces.',
    color: '#a855f7', // Violet
    glowColor: '#7e22ce',
    sourceFile: 'Engineering_Math_Handbook.pdf',
    page: 3,
    confidence: 95,
    summarySnippet: 'Integral transforms, differential equations and linear algebra fundamentals.'
  },
  {
    id: 'laplace',
    name: 'Laplace Transform',
    category: 'Mathematics',
    position: [5.2, 0.9, -2.2],
    related: ['mathematics'],
    documents: 3,
    description: 'Integral transform converting time-domain differential equations into s-domain algebraic equations.',
    color: '#c084fc', // Bright violet
    glowColor: '#9333ea',
    sourceFile: 'Math301_Transforms.pdf',
    page: 45,
    confidence: 97,
    summarySnippet: 'Laplace transforms L{f(t)} = integral e^(-st) f(t) dt from 0 to infinity for RLC circuits.'
  },
  {
    id: 'fourier',
    name: 'Fourier Analysis',
    category: 'Mathematics',
    position: [4.6, -1.2, -0.8],
    related: ['mathematics'],
    documents: 2,
    description: 'Decomposition of periodic continuous and discrete signals into harmonic sinusoidal frequencies.',
    color: '#a855f7',
    glowColor: '#6b21a8',
    sourceFile: 'Signals_and_Fourier.pdf',
    page: 33,
    confidence: 90,
    summarySnippet: 'Frequency spectrum analysis and FFT fast convolution algorithms.'
  },
  {
    id: 'linear-algebra',
    name: 'Linear Algebra',
    category: 'Mathematics',
    position: [2.8, -2.1, -1.8],
    related: ['mathematics', 'ai-neural'],
    documents: 4,
    description: 'Vector spaces, eigenvalues, singular value decomposition (SVD) and matrix projections.',
    color: '#818cf8',
    glowColor: '#4f46e5',
    sourceFile: 'LinAlg_Matrices_Vectors.pdf',
    page: 15,
    confidence: 92,
    summarySnippet: 'Eigenvector decomposition, orthogonal basis, and matrix rank.'
  },

  // --- Java Cluster ---
  {
    id: 'java',
    name: 'Java Runtime',
    category: 'Java',
    position: [1.8, 2.5, 0.5],
    related: ['java-arrays', 'jvm-gc'],
    documents: 4,
    description: 'Object-oriented programming, byte code execution on the JVM, and standard libraries.',
    color: '#f59e0b', // Amber/Orange
    glowColor: '#d97706',
    sourceFile: 'Java_Core_Concepts.pdf',
    page: 5,
    confidence: 93,
    summarySnippet: 'Memory architecture: heap, metaspace, stack frames and thread safety.'
  },
  {
    id: 'java-arrays',
    name: 'Java Arrays & Collections',
    category: 'Java',
    position: [3.2, 3.4, 1.2],
    related: ['java'],
    documents: 2,
    description: 'Contiguous indexable typed arrays and the Java Collections Framework (ArrayList, HashMap).',
    color: '#fbbf24',
    glowColor: '#b45309',
    sourceFile: 'Java_Arrays_Memory.pdf',
    page: 29,
    confidence: 91,
    summarySnippet: 'Array allocation on heap, bounds checking and System.arraycopy internals.'
  },
  {
    id: 'jvm-gc',
    name: 'Garbage Collection',
    category: 'Java',
    position: [1.2, 3.8, -0.4],
    related: ['java'],
    documents: 3,
    description: 'Generational memory management: Eden space, Survivor spaces, Tenured generation and G1 GC.',
    color: '#f59e0b',
    glowColor: '#b45309',
    sourceFile: 'JVM_Tuning_Guide.pdf',
    page: 64,
    confidence: 88,
    summarySnippet: 'Mark-sweep-compact phases and stop-the-world pause reduction.'
  },

  // --- Operating Systems Cluster ---
  {
    id: 'os',
    name: 'Operating Systems',
    category: 'Operating Systems',
    position: [-1.2, -2.6, 1.8],
    related: ['virtual-memory', 'process-scheduling'],
    documents: 5,
    description: 'Kernel architectures, resource allocation, concurrency control and hardware abstractions.',
    color: '#10b981', // Emerald
    glowColor: '#059669',
    sourceFile: 'OS_Silberschatz_Summary.pdf',
    page: 8,
    confidence: 94,
    summarySnippet: 'Monolithic vs microkernels, user space context switching and syscalls.'
  },
  {
    id: 'virtual-memory',
    name: 'Virtual Memory & Paging',
    category: 'Operating Systems',
    position: [-2.6, -3.4, 2.5],
    related: ['os'],
    documents: 3,
    description: 'Address space translations, TLB cache lookups, page faults, and replacement strategies (LRU).',
    color: '#34d399',
    glowColor: '#10b981',
    sourceFile: 'OS_VirtualMemory_Paging.pdf',
    page: 52,
    confidence: 95,
    summarySnippet: 'Multi-level page tables, TLB shootdowns, and dirty bit swapping.'
  },
  {
    id: 'process-scheduling',
    name: 'Process Scheduling',
    category: 'Operating Systems',
    position: [0.2, -3.6, 2.1],
    related: ['os'],
    documents: 2,
    description: 'Preemptive and cooperative CPU dispatchers: Round Robin, Multi-Level Feedback Queues, CFS.',
    color: '#10b981',
    glowColor: '#047857',
    sourceFile: 'OS_CPU_Scheduling.pdf',
    page: 28,
    confidence: 87,
    summarySnippet: 'Completely Fair Scheduler (CFS) virtual runtime tracking via red-black trees.'
  },

  // --- AI & Machine Learning Cluster ---
  {
    id: 'ai-neural',
    name: 'AI & Neural Networks',
    category: 'AI & ML',
    position: [0.5, 0.4, -3.2],
    related: ['transformers', 'linear-algebra'],
    documents: 6,
    description: 'Deep learning architectures, continuous representation spaces, and gradient optimization.',
    color: '#ec4899', // Pink / Magenta
    glowColor: '#db2777',
    sourceFile: 'DeepLearning_Foundations.pdf',
    page: 14,
    confidence: 96,
    summarySnippet: 'Stochastic gradient descent, backpropagation chain rule and tensor graph execution.'
  },
  {
    id: 'transformers',
    name: 'Transformer Attention',
    category: 'AI & ML',
    position: [1.9, 1.2, -4.1],
    related: ['ai-neural'],
    documents: 4,
    description: 'Scaled dot-product multi-head attention mechanisms for sequence modeling without recurrence.',
    color: '#f43f5e',
    glowColor: '#e11d48',
    sourceFile: 'Attention_Is_All_You_Need_Notes.pdf',
    page: 4,
    confidence: 98,
    summarySnippet: 'Softmax(QK^T / sqrt(d_k))V mechanism enabling parallelized context recovery.'
  },

  // --- Projects Cluster ---
  {
    id: 'projects',
    name: 'MemorySpace Architecture',
    category: 'Projects',
    position: [-0.4, -0.6, -1.8],
    related: ['data-structures', 'ai-neural'],
    documents: 3,
    description: 'Personal knowledge recovery engine operating on associative semantic embeddings and 3D visual constellations.',
    color: '#6366f1', // Indigo
    glowColor: '#4338ca',
    sourceFile: 'MemorySpace_System_Spec.pdf',
    page: 1,
    confidence: 99,
    summarySnippet: '3D digital universe connecting personal notes, PDFs, codebases and contextual memories.'
  }
];

export interface SearchPreset {
  query: string;
  matchedNodeId: string;
  highlightedIds: string[];
}

export const MOCK_SEARCH_PRESETS: SearchPreset[] = [
  {
    query: 'I remember something about postfix evaluation',
    matchedNodeId: 'postfix',
    highlightedIds: ['data-structures', 'stack', 'postfix']
  },
  {
    query: 'I remember where I studied postfix evaluation',
    matchedNodeId: 'postfix',
    highlightedIds: ['data-structures', 'stack', 'postfix']
  },
  {
    query: 'Laplace transform s domain formula',
    matchedNodeId: 'laplace',
    highlightedIds: ['mathematics', 'laplace']
  },
  {
    query: 'How Java allocates memory for arrays',
    matchedNodeId: 'java-arrays',
    highlightedIds: ['java', 'java-arrays']
  },
  {
    query: 'Virtual memory page fault handling',
    matchedNodeId: 'virtual-memory',
    highlightedIds: ['os', 'virtual-memory']
  },
  {
    query: 'Transformer attention self context',
    matchedNodeId: 'transformers',
    highlightedIds: ['ai-neural', 'transformers']
  }
];

// MOCK_RECENT_MEMORIES and MOCK_CATEGORIES have been removed.
// Category counts are now computed dynamically from the authenticated
// user's real documents fetched from Supabase (public.documents table).
