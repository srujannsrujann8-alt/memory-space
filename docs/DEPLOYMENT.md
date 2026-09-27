# MemorySpace — Production Deployment Guide

This guide details how to build and deploy MemorySpace to production.

---

## 1. Architecture

MemorySpace consists of:
- **Client (SPA)**: Vite + React 19 single-page application built to static files (`dist/`).
- **Server Middlewares**: Node.js endpoints mounted via Vite dev/preview server or deployed as serverless functions/Node server:
  - `GET  /api/health` — Status and configuration check.
  - `POST /api/search` — Gemini query embedding + pgvector semantic retrieval.
  - `POST /api/answer` — Grounded RAG answer generation.
  - `POST /api/chat` — Multi-turn persistent conversational RAG.
  - `POST /api/embed-chunks` — Document chunk vectorization.
  - `POST /api/topics/extract` — Concept extraction.
  - `POST /api/insights/analyze` — Curriculum coverage & gap analysis.
- **Backend as a Service**: Supabase (PostgreSQL 15+ with `pgvector`, Auth, Storage).

---

## 2. Production Build

To produce the production distribution:

```bash
npm run build
```

This executes:
1. `tsc -b` — TypeScript project reference compiler (strict type checking, 0 errors).
2. `vite build` — Bundles and minifies all assets into `dist/`.

Output directory:
- `dist/index.html` — Entry point with SPA mounting.
- `dist/assets/index-[hash].js` — Client runtime.
- `dist/assets/index-[hash].css` — Stylesheet.
- `dist/assets/pdf.worker-[hash].mjs` — PDF.js web worker.

---

## 3. Deployment Environments & Hosting Options

### Option A: Node.js Container / Full-Stack Service (Render, Railway, Fly.io, AWS App Runner)
- Mount the Vite preview or custom Express/Fastify server with the middleware handlers in `server/`.
- Ensure environment variables are loaded from the platform secrets vault:
  ```env
  VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
  VITE_SUPABASE_STORAGE_BUCKET=knowledge-files
  EMBEDDING_API_KEY=<your-gemini-key>
  GEMINI_GENERATION_MODEL=gemini-3.8-flash
  GEMINI_FALLBACK_MODEL=gemini-3.7-flash
  RATE_LIMIT_WINDOW_MS=60000
  RATE_LIMIT_MAX_REQUESTS=30
  ```
- Command to run:
  ```bash
  npm run preview -- --host 0.0.0.0 --port $PORT
  ```

### Option B: Vercel / Netlify (Serverless)
- The static files in `dist/` are served by the CDN.
- The `server/` handlers can be mapped to serverless route handlers (`/api/[...route]`).
- Set SPA fallback routing rules (e.g. `rewrites: [{ source: "/((?!api/).*)", destination: "/index.html" }]`).

---

## 4. SPA Fallback & Routing Configuration

Because MemorySpace is a Single-Page Application (SPA) using React Router, any deep link (e.g. `/search`, `/documents`, `/ai-assistant`, `/graph`, `/memory`) must serve `dist/index.html`.

### NGINX Configuration:
```nginx
server {
    listen 80;
    server_name memoryspace.example.com;
    root /var/www/memoryspace/dist;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com;" always;

    # API Proxy to Node.js backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA Client Routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 5. Pre-Deployment Verification Checklist

Before taking the deployment live to users:

- [ ] Supabase project created with PostgreSQL 15+.
- [ ] SQL migrations applied in sequential order (`phase3` -> `phase5a` -> `phase5b` -> `phase5c` -> `phase6` -> `phase8`).
- [ ] Storage bucket `knowledge-files` created and verified `public: false`.
- [ ] Row Level Security (RLS) confirmed enabled on all 9 application tables.
- [ ] `EMBEDDING_API_KEY` configured in server environment only (NOT in client bundle).
- [ ] `GET /api/health` returns `{"ok": true, "services": {"supabase": "ok", ...}}`.
- [ ] Unauthenticated API requests receive `401 Unauthorized`.
- [ ] Rate limiting active (tested with rapid requests receiving `429 Too Many Requests`).
- [ ] Production build (`npm run build`) completes with code 0.
- [ ] Code linter (`npm run lint`) passes with 0 errors.
