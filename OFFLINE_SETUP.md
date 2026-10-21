# Testing the Offline Stack

## Prerequisites
- Docker + Docker Compose installed
- ~10GB free disk (model weights) and ideally 8GB+ RAM

## Run it — build sequentially, not with a single `--build`

Building backend and frontend **at the same time** can exhaust a
memory-limited Docker VM (this is what caused repeated Node
"JavaScript heap out of memory"-style crashes during testing — the
backend's ML package install and the frontend's webpack build were
competing for the same limited memory pool). Avoid that by building
one at a time:

```
cd Offline-Chatbot-main
docker compose build backend
docker compose build frontend
docker compose up
```

First run will take a while: it builds both images (baking in the
embedding + Whisper models), starts Mongo + Ollama, and pulls the
Ollama model (default `qwen2.5:3b`, ~2GB). This is the ONE time
internet is needed.

### If the frontend build still runs out of memory (Windows/WSL2)

Docker Desktop's Resources → Memory slider does not always fully take
effect on the WSL2 backend. If increasing it in the GUI didn't help,
set it directly for WSL2 itself:

1. Close Docker Desktop.
2. Open (or create) `%UserProfile%\.wslconfig` in a text editor and add:
   ```
   [wsl2]
   memory=8GB
   ```
   (use a number a couple GB below your machine's total RAM)
3. Open PowerShell and run: `wsl --shutdown`
4. Restart Docker Desktop, then re-run the build commands above.

- Frontend: http://localhost:8080
- Backend API docs: http://localhost:8000/docs

## To use a bigger model (if you have a GPU)
Create a `.env` file next to `docker-compose.yml`:
```
OLLAMA_MODEL=mistral:7b
```
Then re-run `docker compose up --build`.

## The real offline test
1. With internet on, sign up, upload a PDF/DOCX/image/audio file, wait for it to reach "indexed" status.
2. Ask it a question in chat, confirm you get a cited answer.
3. **Disconnect the machine's network entirely.**
4. Ask another question about the same document.
5. If you get a correct, cited answer with no errors — the offline goal is proven end-to-end.

## New Recall@5 / MRR eval endpoint
```
POST /api/eval
{
  "eval_set": [
    {"query": "your test question", "relevant_doc_ids": ["<doc id from GET /api/documents>"]}
  ],
  "top_k": 5
}
```
Returns real recall_at_5 / mrr computed against your actual indexed documents
and current settings — not fabricated numbers.

## What changed in this update
- `frontend/package.json` — added `ajv: ^8.12.0` as a direct devDependency.
  This fixes a real npm dependency-hoisting conflict (verified with an
  actual full production build in a clean install): `eslint` is the only
  package needing `ajv@6`, while `schema-utils`/`workbox-build`/`ajv-formats`
  all need `ajv@8`. Without this, npm hoisted the wrong version to the top
  level and `ajv-keywords` (a peer dependency, not auto-nested by npm)
  resolved the wrong one at runtime. Adding this tips hoisting correctly:
  `ajv@8` takes the top-level slot, `eslint` gets its own private nested
  `ajv@6`. Confirmed with `Compiled successfully.` end to end.
- `backend/ingestion/parsers.py` — audio transcription now uses local
  `faster-whisper` by default (`STT_PROVIDER=local`); old cloud path kept
  behind `STT_PROVIDER=cloud` as a fallback only.
- `backend/core/config.py` — added STT_PROVIDER / WHISPER_* settings.
- `backend/eval/retrieval_eval.py` (new) — real Recall@5/MRR implementation.
- `backend/api/system_routes.py` — `/api/eval` now does real computation on POST.
- `backend/models/schemas.py` — added EvalRequest/EvalQuery schemas.
- `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`,
  `docker-compose.yml` (all new) — full offline-packaged deployment.

## What's been actually verified vs. what still needs your machine
**Verified with real, full end-to-end runs in this session** (not guesses):
frontend npm install + full production build (`Compiled successfully.`),
backend Python imports/logic under simulated missing-package conditions,
Recall@5/MRR math against hand-computed test cases, all Dockerfile/YAML syntax.

**Still needs your machine** (no Docker daemon, no GPU, blocked external
hosts in the sandbox this was built in): the actual `docker compose up`
full-stack run, Ollama serving real answers, faster-whisper transcribing
real speech. Please report back anything that breaks so it can be fixed.

## ChatGPT-style features

- Tables: ask "show this as a table" and the reply renders a real table (Copy -> paste into Excel, or CSV download).
- Files: ask "make an Excel/CSV/Word/PDF of ..." and a Download card appears. Files are built offline and stored in the `generated_data` volume.
- Memory: the last 8 messages of a conversation are sent to the model so follow-ups work.
- Stop button: the send button turns into Stop while the answer is streaming.
- After pulling this update run: `docker compose up -d --build backend frontend`
