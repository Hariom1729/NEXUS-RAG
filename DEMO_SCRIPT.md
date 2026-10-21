# NEXUS-RAG — 5-Minute Faculty Demo Script

Exact click-path for a live demo. Total time ≈ 5 minutes.

**Login:** `admin@nexusrag.ai` / `admin123`

---

### 0. Setup (before the demo)
Run once so the KB isn't empty:
```bash
python scripts/seed_data.py
```
This ingests a mixed corpus (3 PDFs + 1 diagram image) into the `demo` collection.

---

### 1. Offline story (30s) — **System Status** tab
- Point to the green **"Offline Mode Active"** pulse.
- Explain the honest **LLM substitution flag**: retrieval (embeddings + ChromaDB + RRF) runs fully offline; generation uses Ollama/Mistral-7B locally, or a clearly-flagged cloud model in this GPU-less sandbox.
- Show **ChromaDB vector counts** (text + visual) and embedding model names.

### 2. Ingestion (60s) — **Ingest** tab
- Drag in a new PDF **and** an image together.
- Narrate the live pipeline: **Queued → Parsing → Embedding → Indexed**, with chunk counts.
- Note automatic modality routing (text path vs CLIP visual path).

### 3. Ask a grounded question (90s) — **Chat** tab
- Ask: *"What indexing and fusion method does NEXUS-RAG use, and why is it offline?"*
- Watch the **streamed** answer.
- Expand a **source card** (doc/image icon, filename, relevance score). Open an image source to show the thumbnail.
- Point to the **latency badges** (embed / retrieve / generate / total).

### 4. Explainability (90s) — **Explainability** tab
- Show the three ranked columns: **Text path (MiniLM)** vs **Visual path (CLIP)** vs **Fused (RRF)** — same query, different rankings, then fusion.
- Show the **PCA 2D embedding-space** scatter (text vs visual points).
- Show the **latency breakdown** stacked bar across recent queries.

### 5. Management + Admin (30s)
- **Knowledge Base** tab: dense table, filter by `demo` collection, show re-index / delete actions.
- **Admin** tab: system-wide totals, documents-by-modality donut, per-user table.

---

### Closing line
> "Every stage you saw — embedding, vector storage, RRF fusion — executed for real and offline. Only the final text generation uses a flagged cloud model here because the sandbox has no GPU; on a workstation with Ollama it runs entirely offline."
