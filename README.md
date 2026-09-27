# MemorySpace — Personal Knowledge Intelligence Platform

**MemorySpace** is an AI-powered personal knowledge intelligence platform. It ingests academic notes, PDF textbooks, and course documents, extracts text into structured chunks, generates high-dimensional vector embeddings, and enables grounded semantic search, multi-turn conversational RAG, automatic topic extraction, 3D interactive knowledge graphs, and personalized study coverage insights.

---

## Key Features

1. **Document Storage & Vault**:
   - Private Supabase Storage bucket (`knowledge-files`) with strict user isolation via signed private URLs.
   - Support for PDF, DOCX, PPTX, TXT, MD, code, and images.
2. **Text Extraction & Chunking**:
   - In-browser PDF and text extraction via PDF.js worker.
   - Configurable token chunking with overlap to preserve semantic boundaries.
3. **Semantic Vector Search (Phase 6)**:
   - Google Gemini `gemini-embedding-001` (768 dimensions).
   - PostgreSQL `pgvector` similarity search via `search_document_chunks` RPC.
   - Interactive search bar with similarity percentages, chunk cards, and direct source document opening.
4. **Grounded AI Answers & RAG (Phase 7)**:
   - Grounded generation powered by Gemini (`gemini-3.8-flash` with cascading fallback to `gemini-3.7-flash` and `gemini-3.6-flash`).
   - Anti-hallucination prompt constraints; returns explicit insufficient evidence notifications when questions fall outside user notes.
   - Direct "Open Document" action on every cited source chunk.
5. **Conversational Memory & Multi-Turn Chat (Phase 8A/8B)**:
   - Persistent conversation threads stored in Supabase with message history drawer.
   - Pronoun/reference query reformulation for follow-up questions (e.g. *"Why are they useful?"*).
6. **Concept & Topic Extraction (Phase 8C)**:
   - Automatic extraction of topics and concepts linked to source documents.
7. **3D Knowledge Graph (Phase 8D/8E)**:
   - Interactive Three.js / React Three Fiber graph visualizing documents, categories, topics, and relationships.
   - Quick filters for Documents, Categories, and Topics.
8. **Curriculum Coverage & Gap Analysis (Phase 8F)**:
   - Analyzes uploaded study notes against user study goals (e.g. *"Prepare for a web development exam"*).
   - Identifies well-covered topics, lightly covered areas, gaps, and study recommendations.
9. **Production Hardening (Phase 9)**:
   - Server-side sliding-window rate limiting on all AI endpoints.
   - Strict UUID and payload length validation.
   - Complete Row Level Security (RLS) across all 9 application tables.
   - Health check endpoint (`GET /api/health`).
   - Zero credential leakage; all API keys and service secrets remain server-side.

---

## Architecture

```
Client (Vite + React 19 + TypeScript + Tailwind CSS)
  │
  ├── Browser UI (/documents, /search, /ai-assistant, /graph, /memory)
  ├── Supabase JS SDK (Auth & Storage download with signed URLs)
  └── PDF.js Worker (Client-side text extraction)
       │
       ▼
Server Middlewares (Node.js HTTP handlers inside Vite / Express)
  │
  ├── GET  /api/health           (Lightweight health check)
  ├── POST /api/search           (Query embedding + pgvector search)
  ├── POST /api/answer           (Single-turn RAG generation)
  ├── POST /api/chat             (Multi-turn conversational RAG)
  ├── POST /api/embed-chunks     (Batch vector embedding)
  ├── POST /api/topics/extract   (Concept extraction)
  └── POST /api/insights/analyze (Knowledge gap analysis)
       │
       ├── Google Gemini API (gemini-embedding-001, gemini-3.8-flash)
       └── Supabase PostgreSQL (pgvector + RLS user isolation)
```

---

## Getting Started

### 1. Prerequisites
- Node.js 18+ or 20+
- A Supabase account and project
- A Google Gemini API key

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your configuration:
```env
# Client Configuration (Public)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
VITE_SUPABASE_STORAGE_BUCKET=knowledge-files

# Server Configuration (Private — NEVER commit to Git)
EMBEDDING_API_KEY=your-gemini-api-key
GEMINI_GENERATION_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=gemini-3.7-flash
```

### 3. Database Migrations
Run the SQL scripts in `supabase/` in the Supabase SQL Editor in the following order:
1. `supabase/phase3_documents_and_storage.sql`
2. `supabase/phase5a_document_text_extraction.sql`
3. `supabase/phase5b_document_chunking.sql`
4. `supabase/phase5c_embeddings.sql`
5. `supabase/phase6_vector_search.sql`
6. `supabase/phase8_knowledge_intelligence.sql`

### 4. Development Server
```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Production Build & Linting
```bash
# Run lint check
npm run lint

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## Documentation

- [Production Runbook](docs/PRODUCTION_RUNBOOK.md) — Operational procedures, migrations, backups, and disaster recovery.
- [Deployment Guide](docs/DEPLOYMENT.md) — Production hosting, NGINX configuration, and SPA routing.

---

## License
Private & Proprietary — MemorySpace.
