"""System / offline status, settings, admin, and eval-stub routes."""
from fastapi import APIRouter, Depends, Request, HTTPException

from core.db import db
from core.config import settings
from core.security import get_current_user, require_admin
from models.schemas import SettingsModel, EvalRequest
from retrieval import chroma_client
from llm import ollama_client, lm_studio_client, generator
from eval.retrieval_eval import run_eval

router = APIRouter(tags=["system"])


# ---------- System / offline status ----------
@router.get("/system/status")
async def system_status(user: dict = Depends(get_current_user)):
    s = await db.user_settings.find_one({"user_id": user["id"]}) or {}
    prov = s.get("local_llm_provider", settings.LOCAL_LLM_PROVIDER)
    lm_host = s.get("lm_studio_host", settings.LM_STUDIO_HOST)
    lm_model = s.get("lm_studio_model", settings.LM_STUDIO_MODEL)
    o_host = s.get("ollama_host", settings.OLLAMA_HOST)
    o_model = s.get("ollama_model", settings.OLLAMA_MODEL)

    stats = chroma_client.stats()
    lm_studio = await lm_studio_client.status(lm_host, lm_model)
    ollama = await ollama_client.status(o_host, o_model)

    active_host = lm_host if prov == "lm_studio" else o_host
    active_model = lm_model if prov == "lm_studio" else o_model
    backend = await generator.active_backend(active_host, active_model, provider=prov)

    return {
        "offline_mode": True,
        "offline_note": (
            "Retrieval (SentenceTransformers + CLIP + ChromaDB HNSW + RRF) runs fully "
            "offline on-box. Local LLM generation uses LM Studio or Ollama."
        ),
        "local_llm_provider": prov,
        "llm_backend": backend,
        "lm_studio": lm_studio,
        "ollama": ollama,
        "vector_store": {
            "engine": "ChromaDB (persistent, HNSW/cosine)",
            "persist_dir": settings.CHROMA_PERSIST_DIR,
            **stats,
        },
        "embedding_models": {
            "text": settings.TEXT_EMBED_MODEL,
            "visual": settings.VISUAL_EMBED_MODEL,
        },
    }


# ---------- LM Studio connection test ----------
@router.post("/system/lmstudio/test")
async def lmstudio_test(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    host = (body.get("host") or "").strip() or None
    model = (body.get("model") or "").strip() or None
    result = await lm_studio_client.status(host, model)
    return result


# ---------- Ollama connection test ----------
@router.post("/system/ollama/test")
async def ollama_test(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    host = (body.get("host") or "").strip() or None
    model = (body.get("model") or "").strip() or None
    result = await ollama_client.status(host, model)
    return result


# ---------- Settings ----------
DEFAULTS = {
    "chunk_size": 800, "chunk_overlap": 120, "top_k": 5,
    "rrf_text_weight": 1.0, "rrf_visual_weight": 1.0,
    "local_llm_provider": settings.LOCAL_LLM_PROVIDER,
    "lm_studio_host": settings.LM_STUDIO_HOST, "lm_studio_model": settings.LM_STUDIO_MODEL,
    "ollama_host": settings.OLLAMA_HOST, "ollama_model": settings.OLLAMA_MODEL,
}



@router.get("/settings")
async def get_settings_route(user: dict = Depends(get_current_user)):
    s = await db.user_settings.find_one({"user_id": user["id"]}, {"_id": 0, "user_id": 0})
    return s or DEFAULTS


@router.put("/settings")
async def update_settings(payload: SettingsModel, user: dict = Depends(get_current_user)):
    data = payload.model_dump()
    await db.user_settings.update_one(
        {"user_id": user["id"]}, {"$set": {**data, "user_id": user["id"]}}, upsert=True)
    return data


# ---------- Admin ----------
@router.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_docs = await db.documents.count_documents({})
    total_convs = await db.conversations.count_documents({})
    total_msgs = await db.messages.count_documents({})
    by_modality = {}
    for mod in ("document", "image", "audio"):
        by_modality[mod] = await db.documents.count_documents({"modality": mod})
    by_status = {}
    for st in ("queued", "parsing", "embedding", "indexed", "failed"):
        by_status[st] = await db.documents.count_documents({"status": st})
    stats = chroma_client.stats()
    users = await db.users.find({}, {"_id": 1, "name": 1, "email": 1, "role": 1}).to_list(200)
    per_user = []
    for u in users:
        uid = str(u["_id"])
        per_user.append({
            "name": u.get("name"), "email": u.get("email"), "role": u.get("role"),
            "documents": await db.documents.count_documents({"user_id": uid}),
            "conversations": await db.conversations.count_documents({"user_id": uid}),
        })
    return {
        "totals": {"users": total_users, "documents": total_docs,
                   "conversations": total_convs, "messages": total_msgs},
        "by_modality": by_modality, "by_status": by_status,
        "vector_store": stats, "users": per_user,
    }


# ---------- Retrieval evaluation (Recall@K, MRR) ----------
@router.get("/eval")
async def eval_info(user: dict = Depends(get_current_user)):
    """Documents the interface. POST /eval with a labeled query set to get real metrics."""
    return {
        "status": "not_configured",
        "message": (
            "GET returns this documentation only — no metrics are fabricated. "
            "POST to this same path with a labeled eval set to compute real "
            "Recall@5 and MRR against your current retrieval pipeline and "
            "settings (chunking, top_k, RRF weights)."
        ),
        "expected_interface": {
            "input": {"eval_set": [{"query": "str", "relevant_doc_ids": ["str"]}],
                       "top_k": 5, "collection": "optional str"},
            "output": {"recall_at_5": "float", "mrr": "float", "per_query": "list"},
        },
        "how_to_get_doc_ids": (
            "Use GET /api/documents to list your indexed documents and copy their "
            "'id' fields into relevant_doc_ids for each query."
        ),
        "metrics": None,
    }


@router.post("/eval")
async def eval_run(payload: EvalRequest, user: dict = Depends(get_current_user)):
    """Compute Recall@K and MRR for a labeled query set, using the real,
    currently-configured retrieval pipeline (same code path as /chat)."""
    if not payload.eval_set:
        raise HTTPException(status_code=400, detail="eval_set must contain at least one query")

    s = await db.user_settings.find_one({"user_id": user["id"]}) or {}
    rrf_text_weight = s.get("rrf_text_weight", 1.0)
    rrf_visual_weight = s.get("rrf_visual_weight", 1.0)

    result = await run_eval(
        eval_set=[q.model_dump() for q in payload.eval_set],
        user_id=user["id"],
        top_k=payload.top_k,
        rrf_text_weight=rrf_text_weight,
        rrf_visual_weight=rrf_visual_weight,
        collection=payload.collection,
    )
    return result
