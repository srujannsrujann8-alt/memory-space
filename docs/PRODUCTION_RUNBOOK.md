# MemorySpace — Production Runbook

This runbook covers operations, migrations, backups, recoveries, and troubleshooting for the **MemorySpace** personal knowledge platform.

---

## 1. System Overview

MemorySpace combines:
- **Frontend / Client**: React 19 + TypeScript + Vite + Tailwind CSS + Three.js / React Three Fiber.
- **Backend / API**: Node.js HTTP middleware running inside Vite dev/preview or production server (`/api/search`, `/api/answer`, `/api/chat`, `/api/embed-chunks`, `/api/topics/*`, `/api/insights/*`, `/api/health`).
- **Database & Storage**: Supabase (PostgreSQL with `pgvector` extension and private Supabase Storage bucket `knowledge-files`).
- **AI Models**:
  - Embedding: Google Gemini `gemini-embedding-001` (768 dimensions).
  - Generation: Google Gemini `gemini-3.8-flash` (Primary), falling back to `gemini-3.7-flash` and `gemini-3.6-flash`.

---

## 2. Environment Setup

### Required Variables
Configured in `.env.local` (local development) or platform environment settings (production):

| Variable | Scope | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Public (Client) | Supabase project URL (e.g., `https://xyz.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public (Client) | Supabase public/anon publishable key |
| `VITE_SUPABASE_STORAGE_BUCKET` | Public (Client) | Private storage bucket name (`knowledge-files`) |
| `EMBEDDING_API_KEY` | Server-Only | Google Gemini API key for embeddings and text generation |
| `GEMINI_GENERATION_MODEL` | Server-Only (Optional) | Override generation model (default: `gemini-3.8-flash`) |
| `GEMINI_FALLBACK_MODEL` | Server-Only (Optional) | Override fallback model (default: `gemini-3.7-flash`) |
| `RATE_LIMIT_WINDOW_MS` | Server-Only (Optional) | Rate limit window in ms (default: `60000`) |
| `RATE_LIMIT_MAX_REQUESTS` | Server-Only (Optional) | Max requests per user per window (default: `30`) |

> **Security Rule**: Never prefix `EMBEDDING_API_KEY` or `GEMINI_API_KEY` with `VITE_`. Server credentials must never be accessible in browser client bundles.

---

## 3. SQL Migrations Execution Order

When initializing a new environment or staging database, apply migrations in `supabase/` strictly in this sequence:

1. **`supabase/phase3_documents_and_storage.sql`**
   - Creates `public.documents` table with RLS.
   - Configures private bucket `knowledge-files`.
   - Creates Storage RLS policies isolating files by `auth.uid()`.
2. **`supabase/phase5a_document_text_extraction.sql`**
   - Creates `public.document_content` table with `document_id` UNIQUE constraint and CASCADE delete.
   - Establishes RLS policies for document content.
3. **`supabase/phase5b_document_chunking.sql`**
   - Creates `public.document_chunks` table with `(document_content_id, chunk_index)` UNIQUE constraint.
   - Sets up performance indexes.
4. **`supabase/phase5c_embeddings.sql`**
   - Enables `vector` extension.
   - Adds `embedding vector(768)` column to `document_chunks`.
5. **`supabase/phase6_vector_search.sql`**
   - Creates `search_document_chunks` RPC function with `SECURITY INVOKER` and `auth.uid()` checks.
   - Grants execute to `authenticated` and revokes from `anon`.
6. **`supabase/phase8_knowledge_intelligence.sql`**
   - Creates `conversations`, `conversation_messages`, `message_sources`.
   - Creates `knowledge_topics`, `document_topics`, `knowledge_insights`.
   - Enables RLS on all 6 tables and establishes cascading / set-null foreign keys.

---

## 4. Secret Configuration & Rotation

### Gemini API Key Rotation:
1. Generate new API key in Google AI Studio.
2. Update `EMBEDDING_API_KEY` in production environment settings.
3. Trigger service restart or redeploy.
4. Verify by calling `GET /api/health` and performing a test query.
5. Decommission old key in Google AI Studio.

### Supabase Key Rotation:
1. Rotate anon/publishable key in Supabase Dashboard -> Settings -> API.
2. Update `VITE_SUPABASE_PUBLISHABLE_KEY` in environment.
3. Rebuild frontend bundle (as client uses this bundle).

---

## 5. Build & Execution

```bash
# Install dependencies
npm install

# Run linter
npm run lint

# Compile TypeScript & create optimized production bundle
npm run build

# Start local server / dev environment
npm run dev

# Preview production build locally
npm run preview
```

---

## 6. Backup Strategy

### Database (PostgreSQL / Supabase):
- **Automated Backups**: Ensure Supabase Pro/Team daily automated backups and Point-In-Time-Recovery (PITR) are enabled for production projects.
- **Manual Logical Backup (pg_dump)**:
  ```bash
  # Dump database schema and data excluding vector internals if needed
  pg_dump -h <db.ref.supabase.co> -U postgres -d postgres -F c -b -v -f "memoryspace_backup_$(date +%Y%m%d).dump"
  ```

### Storage (`knowledge-files` Bucket):
- Files are organized as `{user_id}/{timestamp}_{filename}`.
- To sync/backup storage objects:
  Use Supabase CLI or S3-compatible tool (Supabase Storage is S3-compatible):
  ```bash
  aws s3 sync s3://knowledge-files ./storage_backup/ --endpoint-url <supabase_s3_endpoint>
  ```

---

## 7. Disaster Recovery Procedure

### Database Restore:
1. **Restore via Supabase Dashboard**: Use PITR to rewind to the timestamp immediately before data corruption or incident.
2. **Fresh Instance Provisioning**:
   - Provision new Supabase project.
   - Run SQL migrations in sequence (1 through 6).
   - Restore data dump:
     ```bash
     pg_restore -h <new-db-host> -U postgres -d postgres -v "memoryspace_backup.dump"
     ```
   - Update `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Storage Restore:
1. Ensure bucket `knowledge-files` is marked `public: false`.
2. Sync backed up files back into `knowledge-files`.
3. Verify signed URL generation works via `getDocumentUrl`.

---

## 8. Troubleshooting Guide

| Symptom | Cause | Solution |
|---|---|---|
| `HTTP 401 Unauthorized` | Missing or expired JWT token | Ensure client includes `Authorization: Bearer <session.access_token>`. Sign in again. |
| `HTTP 429 Too Many Requests` | Sliding window rate limit exceeded (30 req/min) | Wait for retry window or increase `RATE_LIMIT_MAX_REQUESTS` in env. |
| `HTTP 502 / UNAVAILABLE` | Gemini transient overload | The built-in retry and fallback logic in `geminiGeneration.ts` handles transient 503s automatically. If all 3 models fail, verify Gemini service status. |
| `HTTP 503 missing_api_key` | `EMBEDDING_API_KEY` not found | Verify `.env.local` or production environment configuration has `EMBEDDING_API_KEY`. |
| `PGRST202 / search_document_chunks` | Schema cache out of date | Run `NOTIFY pgrst, 'reload schema'` in Supabase SQL editor. |
| Signed URL expires or 403 on open | Storage RLS policy mismatch | Verify path starts with `{auth.uid()}/` and storage policy in `phase3` is applied. |
