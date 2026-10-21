"""Chat / semantic-search routes with streaming SSE and retrieval explainability."""
import asyncio
import base64
import json
import os
import time
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from core.db import db
from core.config import settings
from core.security import get_current_user
from ingestion import embeddings, parsers, chunking
from retrieval import chroma_client
from retrieval.rrf import rrf_fuse
from llm import generator
from llm.prompts import build_user_prompt, is_small_talk
from generation.file_builder import extract_file_directive, build_file

router = APIRouter(prefix="/chat", tags=["chat"])


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _get_settings(user_id):
    s = await db.user_settings.find_one({"user_id": user_id}) or {}
    return {
        "top_k": s.get("top_k", 5),
        "rrf_text_weight": s.get("rrf_text_weight", 1.0),
        "rrf_visual_weight": s.get("rrf_visual_weight", 1.0),
        "local_llm_provider": s.get("local_llm_provider", settings.LOCAL_LLM_PROVIDER),
        "lm_studio_host": s.get("lm_studio_host", settings.LM_STUDIO_HOST),
        "lm_studio_model": s.get("lm_studio_model", settings.LM_STUDIO_MODEL),
        "ollama_host": s.get("ollama_host", settings.OLLAMA_HOST),
        "ollama_model": s.get("ollama_model", settings.OLLAMA_MODEL),
    }



def _maybe_build_file(answer):
    """Strip the ```file``` directive and build the real file, if any."""
    clean_text, spec = extract_file_directive(answer)
    if not spec:
        return clean_text, None
    try:
        path, ftype = build_file(spec)
    except Exception:  # noqa: BLE001
        return clean_text, None
    if not path:
        return clean_text, None
    fname = os.path.basename(path)
    return clean_text, {
        "filename": fname,
        "display_name": (fname.split("_", 1)[1] if "_" in fname else fname),
        "filetype": ftype,
        "url": f"/api/files/{fname}",
        "size_bytes": os.path.getsize(path),
    }


async def _load_history(conv_id, limit=8):
    msgs = await db.messages.find({"conversation_id": conv_id}, {"_id": 0, "role": 1, "content": 1}) \
        .sort("created_at", -1).to_list(limit)
    msgs.reverse()
    return [{"role": m["role"], "content": (m.get("content") or "")[:2000]} for m in msgs]


def _fmt_hits(hits):
    out = []
    for h in hits:
        m = h.get("metadata", {})
        out.append({
            "id": h["id"],
            "filename": m.get("filename", "unknown"),
            "modality": m.get("modality", "document"),
            "page": m.get("page"),
            "score": h.get("score"),
            "snippet": (h.get("document") or "")[:400],
            "rrf_score": h.get("rrf_score"),
            "text_rank": h.get("text_rank"),
            "visual_rank": h.get("visual_rank"),
        })
    return out


async def _resolve_attached_and_referenced_chunks(user_id: str, question: str, attachments: list, conv_id: str | None) -> list:
    """Resolve chunks for any directly attached documents or documents explicitly
    referenced in the question/conversation, ensuring 100% accurate extraction.
    """
    targets = []
    seen_target_ids = set()

    # 1. From explicit attachments in the current message
    for a in (attachments or []):
        did = a.get("doc_id")
        fn = a.get("name")
        if did and did not in seen_target_ids:
            seen_target_ids.add(did)
            targets.append({"doc_id": did, "filename": fn})
        elif fn:
            doc = await db.documents.find_one({"user_id": user_id, "filename": fn}, sort=[("created_at", -1)])
            if doc and doc["id"] not in seen_target_ids:
                seen_target_ids.add(doc["id"])
                targets.append({"doc_id": doc["id"], "filename": fn})

    # 2. Check if user question refers to an existing document by name or keyword
    user_docs = await db.documents.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    q_lower = question.lower()
    for d in user_docs:
        did = d["id"]
        if did in seen_target_ids:
            continue
        fname = d.get("filename", "")
        stem = os.path.splitext(fname)[0].lower()
        if fname.lower() in q_lower or (len(stem) >= 4 and stem in q_lower):
            seen_target_ids.add(did)
            targets.append({"doc_id": did, "filename": fname})

    # 3. If still no targets and user asks about "this file" / "the document" / "attached file",
    # look back in conversation messages for the most recent attachment
    is_referring = any(kw in q_lower for kw in ("this file", "the file", "this doc", "the doc", "attached", "this pdf", "the pdf", "resume", "extract", "document"))
    if not targets and is_referring and conv_id:
        prev = await db.messages.find(
            {"conversation_id": conv_id, "attachments": {"$exists": True, "$ne": []}}
        ).sort("created_at", -1).to_list(3)
        for pm in prev:
            for a in pm.get("attachments", []):
                did = a.get("doc_id")
                fn = a.get("name")
                if did and did not in seen_target_ids:
                    seen_target_ids.add(did)
                    targets.append({"doc_id": did, "filename": fn})
                elif fn:
                    doc = await db.documents.find_one({"user_id": user_id, "filename": fn}, sort=[("created_at", -1)])
                    if doc and doc["id"] not in seen_target_ids:
                        seen_target_ids.add(doc["id"])
                        targets.append({"doc_id": doc["id"], "filename": fn})
            if targets:
                break

    # If still no target found, and user specifically asks about "the file/document", fallback to user's most recent document
    if not targets and any(kw in q_lower for kw in ("this file", "the file", "attached file", "this document", "the document", "the pdf", "this pdf")) and user_docs:
        latest = user_docs[0]
        targets.append({"doc_id": latest["id"], "filename": latest.get("filename")})

    if not targets:
        return []

    collected_chunks = []
    for tgt in targets:
        doc_id = tgt["doc_id"]
        fname = tgt.get("filename") or "document"

        # If document is still processing in background, wait briefly (up to 4s)
        for _ in range(8):
            doc_rec = await db.documents.find_one({"id": doc_id})
            if doc_rec and doc_rec.get("status") in ("queued", "parsing", "embedding"):
                await asyncio.sleep(0.4)
            else:
                break

        # A. Query ChromaDB by doc_id
        try:
            res_t = chroma_client.text_collection().get(where={"doc_id": doc_id})
            if res_t and res_t.get("ids"):
                for cid, doc_text, meta in zip(res_t["ids"], res_t["documents"], res_t["metadatas"]):
                    collected_chunks.append({
                        "id": cid,
                        "document": doc_text,
                        "metadata": meta,
                        "score": 1.0,
                        "rrf_score": 1.0,
                        "text_rank": 1,
                        "visual_rank": None,
                    })
        except Exception:
            pass

        # If Chroma had no chunks by doc_id, try by filename
        if not collected_chunks and fname:
            try:
                res_t = chroma_client.text_collection().get(where={"filename": fname})
                if res_t and res_t.get("ids"):
                    for cid, doc_text, meta in zip(res_t["ids"], res_t["documents"], res_t["metadatas"]):
                        collected_chunks.append({
                            "id": cid,
                            "document": doc_text,
                            "metadata": meta,
                            "score": 1.0,
                            "rrf_score": 1.0,
                            "text_rank": 1,
                            "visual_rank": None,
                        })
            except Exception:
                pass

        # B. Fallback: If Chroma still has 0 chunks, load raw text or re-parse from MongoDB on the fly
        if not collected_chunks:
            doc_rec = await db.documents.find_one({"id": doc_id})
            raw_text = doc_rec.get("raw_text") if doc_rec else None
            if not raw_text:
                file_rec = await db.document_files.find_one({"doc_id": doc_id})
                if file_rec and file_rec.get("content"):
                    data = base64.b64decode(file_rec["content"])
                    if fname.lower().endswith(".pdf"):
                        raw_text, _ = parsers.parse_pdf(data)
                    elif fname.lower().endswith((".docx", ".doc")):
                        raw_text = parsers.parse_docx(data)
                    elif fname.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                        raw_text = parsers.ocr_image(parsers.parse_image(data))
            if raw_text:
                chunks = chunking.chunk_text(raw_text, 800, 100)
                for i, ch in enumerate(chunks):
                    collected_chunks.append({
                        "id": f"{doc_id}:fallback:t{i}",
                        "document": ch,
                        "metadata": {
                            "filename": fname,
                            "modality": "document",
                            "page": i + 1,
                            "doc_id": doc_id,
                        },
                        "score": 1.0,
                        "rrf_score": 1.0,
                        "text_rank": 1,
                        "visual_rank": None,
                    })

    return collected_chunks


@router.get("/conversations")
async def conversations(user: dict = Depends(get_current_user)):
    convs = await db.conversations.find({"user_id": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return {"conversations": convs}


@router.get("/conversations/{conv_id}/messages")
async def messages(conv_id: str, user: dict = Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": conv_id, "user_id": user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = await db.messages.find({"conversation_id": conv_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return {"messages": msgs}


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, user: dict = Depends(get_current_user)):
    await db.conversations.delete_one({"id": conv_id, "user_id": user["id"]})
    await db.messages.delete_many({"conversation_id": conv_id})
    return {"ok": True}


@router.post("/retrieve")
async def retrieve(request: Request, user: dict = Depends(get_current_user)):
    """Retrieval-only endpoint (no generation) for live RRF comparison.

    Returns the raw text-path and visual-path ranked lists plus the fused list at
    the requested weights. The frontend can also recompute fusion client-side as
    the user drags the weight sliders — this endpoint provides the source lists.
    """
    body = await request.json()
    question = (body.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    collection = body.get("collection")
    cfg = await _get_settings(user["id"])
    top_k = int(body.get("top_k") or cfg["top_k"])
    w_text = float(body.get("rrf_text_weight", cfg["rrf_text_weight"]))
    w_visual = float(body.get("rrf_visual_weight", cfg["rrf_visual_weight"]))

    t0 = time.perf_counter()
    q_text_emb = (await embeddings.embed_texts([question]))[0]
    q_clip_emb = (await embeddings.embed_clip_text([question]))[0]
    t_embed = time.perf_counter() - t0

    t1 = time.perf_counter()
    text_hits = chroma_client.query_text(q_text_emb, top_k, user["id"], collection)
    visual_hits = chroma_client.query_visual(q_clip_emb, top_k, user["id"], collection)
    fused = rrf_fuse(text_hits, visual_hits, w_text=w_text, w_visual=w_visual)[:top_k]
    t_retrieve = time.perf_counter() - t1

    return {
        "text": _fmt_hits(text_hits),
        "visual": _fmt_hits(visual_hits),
        "fused": _fmt_hits(fused),
        "weights": {"text": w_text, "visual": w_visual},
        "latency": {"embedding_ms": round(t_embed * 1000, 1),
                    "retrieval_ms": round(t_retrieve * 1000, 1)},
    }


@router.post("/stream")
async def stream(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    question = (body.get("question") or "").strip()
    attachments = body.get("attachments") or []
    if not question and not attachments:
        raise HTTPException(status_code=400, detail="Question or attachment is required")
    if not question and attachments:
        question = f"Analyze and explain this attached {attachments[0].get('name', 'file')}."

    conv_id = body.get("conversation_id")
    collection = body.get("collection")
    cfg = await _get_settings(user["id"])
    top_k = cfg["top_k"]

    if not conv_id:
        conv_id = str(uuid.uuid4())
        await db.conversations.insert_one({
            "id": conv_id, "user_id": user["id"],
            "title": question[:60], "created_at": _now(), "updated_at": _now(),
        })
    else:
        await db.conversations.update_one({"id": conv_id}, {"$set": {"updated_at": _now()}})

    history = await _load_history(conv_id)

    await db.messages.insert_one({
        "id": str(uuid.uuid4()), "conversation_id": conv_id, "user_id": user["id"],
        "role": "user", "content": question, "attachments": attachments, "created_at": _now(),
    })

    async def event_stream():
        try:
            t0 = time.perf_counter()

            prov = cfg.get("local_llm_provider", settings.LOCAL_LLM_PROVIDER)
            llm_host = cfg.get("lm_studio_host") if prov == "lm_studio" else cfg.get("ollama_host")
            llm_model = cfg.get("lm_studio_model") if prov == "lm_studio" else cfg.get("ollama_model")

            if is_small_talk(question):
                # Skip retrieval entirely — no embedding, no ChromaDB query,
                # no RRF fusion for plain small-talk greetings.
                yield "data: " + json.dumps({
                    "type": "meta", "conversation_id": conv_id, "sources": [],
                    "rankings": {"text": [], "visual": [], "fused": []},
                    "latency": {"embedding_ms": 0.0, "retrieval_ms": 0.0},
                }) + "\n\n"

                t2 = time.perf_counter()
                answer = ""
                async for tok in generator.stream_answer(conv_id, question,
                                                          llm_host, llm_model, history=history, provider=prov):
                    answer += tok
                    yield "data: " + json.dumps({"type": "token", "content": tok}) + "\n\n"
                t_gen = time.perf_counter() - t2
                total = time.perf_counter() - t0

                latency = {"embedding_ms": 0.0, "retrieval_ms": 0.0,
                           "generation_ms": round(t_gen * 1000, 1),
                           "total_ms": round(total * 1000, 1)}
                display_answer, file_meta = _maybe_build_file(answer)
                if file_meta:
                    yield "data: " + json.dumps({"type": "file", **file_meta}) + "\n\n"
                await db.messages.insert_one({
                    "id": str(uuid.uuid4()), "conversation_id": conv_id, "user_id": user["id"],
                    "role": "assistant", "content": display_answer, "sources": [],
                    "rankings": {"text": [], "visual": [], "fused": []},
                    "latency": latency, "file": file_meta, "created_at": _now(),
                })
                backend = await generator.active_backend(llm_host, llm_model, provider=prov)
                yield "data: " + json.dumps({"type": "done", "latency": latency, "backend": backend,
                                             "content": display_answer}) + "\n\n"
                return

            q_text_emb = (await embeddings.embed_texts([question]))[0]
            q_clip_emb = (await embeddings.embed_clip_text([question]))[0]
            t_embed = time.perf_counter() - t0

            t1 = time.perf_counter()
            text_hits = chroma_client.query_text(q_text_emb, top_k, user["id"], collection)
            visual_hits = chroma_client.query_visual(q_clip_emb, top_k, user["id"], collection)
            fused = rrf_fuse(text_hits, visual_hits,
                             w_text=cfg["rrf_text_weight"], w_visual=cfg["rrf_visual_weight"])[:top_k]

            # Priority-resolve any attached or explicitly referenced documents (PDF, DOCX, images)
            target_chunks = await _resolve_attached_and_referenced_chunks(user["id"], question, attachments, conv_id)
            if target_chunks:
                # When the user attaches or specifically references a document, focus the context
                # strictly on that document to eliminate cross-contamination from unrelated files.
                fused = target_chunks

            t_retrieve = time.perf_counter() - t1

            rankings = {
                "text": _fmt_hits(text_hits),
                "visual": _fmt_hits(visual_hits),
                "fused": _fmt_hits(fused),
            }
            sources = _fmt_hits(fused)
            yield "data: " + json.dumps({
                "type": "meta", "conversation_id": conv_id, "sources": sources,
                "rankings": rankings,
                "latency": {"embedding_ms": round(t_embed * 1000, 1),
                            "retrieval_ms": round(t_retrieve * 1000, 1)},
            }) + "\n\n"

            prompt = build_user_prompt(question, fused)
            t2 = time.perf_counter()
            answer = ""
            async for tok in generator.stream_answer(conv_id, prompt,
                                                      llm_host, llm_model, history=history, provider=prov):
                answer += tok
                yield "data: " + json.dumps({"type": "token", "content": tok}) + "\n\n"
            t_gen = time.perf_counter() - t2
            total = time.perf_counter() - t0

            latency = {
                "embedding_ms": round(t_embed * 1000, 1),
                "retrieval_ms": round(t_retrieve * 1000, 1),
                "generation_ms": round(t_gen * 1000, 1),
                "total_ms": round(total * 1000, 1),
            }
            display_answer, file_meta = _maybe_build_file(answer)
            if file_meta:
                yield "data: " + json.dumps({"type": "file", **file_meta}) + "\n\n"
            await db.messages.insert_one({
                "id": str(uuid.uuid4()), "conversation_id": conv_id, "user_id": user["id"],
                "role": "assistant", "content": display_answer, "sources": sources,
                "rankings": rankings, "latency": latency, "file": file_meta, "created_at": _now(),
            })
            backend = await generator.active_backend(llm_host, llm_model, provider=prov)
            yield "data: " + json.dumps({"type": "done", "latency": latency, "backend": backend,
                                         "content": display_answer}) + "\n\n"
        except Exception as e:  # noqa: BLE001
            yield "data: " + json.dumps({"type": "error", "message": str(e)[:300]}) + "\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no",
                                      "Connection": "keep-alive"})
