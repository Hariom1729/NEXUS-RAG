"""Retrieval explainability + analytics dashboard routes."""
import numpy as np
from fastapi import APIRouter, Depends
from sklearn.decomposition import PCA

from core.db import db
from core.security import get_current_user
from retrieval import chroma_client

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/embedding-space")
async def embedding_space(user: dict = Depends(get_current_user)):
    """2D projection (PCA — t-SNE/UMAP-compatible interface) of stored vectors."""
    samples = chroma_client.sample_vectors(user["id"], limit=200)
    if len(samples) < 3:
        return {"points": [], "method": "PCA", "note": "Need at least 3 vectors to project."}

    # project each modality-space separately (dims differ), then merge into one plot
    points = []
    for path in ("text", "visual"):
        group = [s for s in samples if s["path"] == path]
        if len(group) < 2:
            continue
        X = np.array([g["embedding"] for g in group], dtype=float)
        n_comp = 2 if X.shape[0] > 2 else 1
        coords = PCA(n_components=n_comp).fit_transform(X)
        for i, g in enumerate(group):
            x = float(coords[i][0])
            y = float(coords[i][1]) if coords.shape[1] > 1 else 0.0
            points.append({
                "x": round(x, 4), "y": round(y, 4),
                "path": path,
                "filename": g["meta"].get("filename", "?"),
                "modality": g["meta"].get("modality", path),
            })
    return {"points": points, "method": "PCA"}


@router.get("/latency")
async def latency(user: dict = Depends(get_current_user)):
    msgs = await db.messages.find(
        {"user_id": user["id"], "role": "assistant", "latency": {"$exists": True}},
        {"_id": 0, "content": 0, "rankings": 0},
    ).sort("created_at", -1).to_list(15)
    series = []
    for m in reversed(msgs):
        lat = m.get("latency", {})
        series.append({
            "query": (m.get("sources") and "query") or "query",
            "embedding_ms": lat.get("embedding_ms", 0),
            "retrieval_ms": lat.get("retrieval_ms", 0),
            "generation_ms": lat.get("generation_ms", 0),
            "total_ms": lat.get("total_ms", 0),
            "at": m.get("created_at"),
        })
    return {"series": series}


@router.get("/last-retrieval")
async def last_retrieval(user: dict = Depends(get_current_user)):
    msg = await db.messages.find_one(
        {"user_id": user["id"], "role": "assistant", "rankings": {"$exists": True}},
        {"_id": 0}, sort=[("created_at", -1)],
    )
    if not msg:
        return {"rankings": None}
    return {"rankings": msg.get("rankings"), "latency": msg.get("latency"),
            "content": msg.get("content")}
