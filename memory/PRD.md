# NEXUS-RAG — Product Requirements Document

## Original Problem Statement
Build NEXUS-RAG, a full-stack, production-grade **offline multimodal Retrieval-Augmented Generation** system. Ingest DOC/PDF/image/voice files, embed with dual-modality embeddings, store in a local vector DB, and answer questions with a locally-hostable LLM with cited sources. Core value: data privacy, offline operation, cross-modal understanding. Academic B.E. CSE capstone; must be demo-ready.

## Sandbox Substitutions (flagged, user-approved)
- **LLM**: Ollama/Mistral-7B not runnable (no GPU) → Emergent Universal LLM Key (claude-sonnet-4-6) as automatic fallback; real Ollama code path retained (`llm/ollama_client.py`).
- **Visual embeddings**: ColPali (GPU) → CLIP `clip-ViT-B-32` (real, CPU).
- **Frontend**: Next.js 14 → React (CRA), identical UX.
- **Whisper**: local → OpenAI `whisper-1` via Emergent key.
- Real & unmocked: SentenceTransformers text embeddings, CLIP visual embeddings, ChromaDB persistent HNSW, RRF fusion, ingestion pipeline, JWT auth, streaming generation.

## Architecture
- **Backend**: FastAPI (async), MongoDB (metadata), ChromaDB persistent (2 collections: text_chunks 384-d, visual_chunks 512-d, HNSW/cosine). Modular: core/ models/ ingestion/ retrieval/ llm/ api/.
- **Frontend**: React + Tailwind + shadcn/ui + Recharts + Framer Motion + react-dropzone. Dark-first "Academic Enterprise Void" theme (Chivo + IBM Plex).
- **Auth**: JWT Bearer (localStorage `nexus_token`); withCredentials=false (ingress injects wildcard CORS). Admin seeded.

## User Personas
- **Student/Researcher**: ingests own corpus, asks grounded questions, inspects retrieval.
- **Faculty/Admin**: reviews system-wide stats across users during viva.

## Implemented (2026-08-12)
- JWT auth (register/login/me/refresh/logout, brute-force lockout, seeded admin).
- Ingestion pipeline: multi-file upload, modality routing, background jobs, live status (queued→parsing→embedding→indexed/failed), Whisper audio transcription.
- Dual-modality embeddings + ChromaDB HNSW + RRF fusion.
- Streaming chat (SSE meta/token/done), cited sources, latency breakdown, persistent conversations.
- Explainability dashboard: text vs visual vs fused rankings, PCA 2D embedding scatter, latency stacked bar.
- Knowledge base: table, collections filter, reindex, delete, bulk delete.
- System status: offline indicator, LLM backend + substitution flag, Ollama status, Chroma stats.
- Settings: chunk size/overlap, top-k, RRF weights, ollama model.
- Admin dashboard: totals, modality/status charts, per-user table.
- Eval stub `/api/eval` (documented interface, no fabricated metrics).
- Seed script (`scripts/seed_data.py`), README (Mermaid architecture), DEMO_SCRIPT.
- Startup embedding warmup (first query ~1.5s vs ~23s cold).
- **Verified**: testing agent iteration_1 — backend 24/24, frontend 100%.

## Backlog / Remaining
- **P1**: Recall@5 / MRR eval implementation behind `/api/eval` when labeled set provided.
- **P2**: Audio-source transcript excerpt preview in chat source cards (currently text/image previews).
- **P2**: UMAP/t-SNE projection option (currently PCA).
- **P2**: Object-storage adapter for cloud deployment (local FS by design for offline).

## Next Tasks
- Await user feedback / demo run; wire eval set if provided.
