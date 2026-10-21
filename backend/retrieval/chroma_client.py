"""ChromaDB persistent client with HNSW (cosine) indexing.

Two collections implement the dual-modality store:
  text_chunks   -> 384-d SentenceTransformer text embeddings
  visual_chunks -> 512-d CLIP embeddings (page images / images)
Both use hnsw:space=cosine (ChromaDB's HNSW index).
"""
import chromadb
from chromadb.config import Settings as ChromaSettings
from core.config import settings

_client = None


def get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False, allow_reset=True),
        )
    return _client


def text_collection():
    return get_client().get_or_create_collection(
        "text_chunks", metadata={"hnsw:space": "cosine"}
    )


def visual_collection():
    return get_client().get_or_create_collection(
        "visual_chunks", metadata={"hnsw:space": "cosine"}
    )


def _query(coll, embedding, k, where):
    res = coll.query(query_embeddings=[embedding], n_results=k, where=where)
    hits = []
    ids = res.get("ids", [[]])[0]
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]
    dists = res.get("distances", [[]])[0]
    for i, cid in enumerate(ids):
        dist = dists[i] if i < len(dists) else 1.0
        hits.append({
            "id": cid,
            "document": docs[i] if i < len(docs) else "",
            "metadata": metas[i] if i < len(metas) else {},
            "distance": dist,
            "score": round(max(0.0, 1.0 - dist), 4),
        })
    return hits


def query_text(embedding, k, user_id, collection=None):
    where = {"user_id": user_id}
    if collection:
        where = {"$and": [{"user_id": user_id}, {"collection": collection}]}
    return _query(text_collection(), embedding, k, where)


def query_visual(embedding, k, user_id, collection=None):
    where = {"user_id": user_id}
    if collection:
        where = {"$and": [{"user_id": user_id}, {"collection": collection}]}
    return _query(visual_collection(), embedding, k, where)


def add_text_chunks(ids, embeddings, documents, metadatas):
    if ids:
        text_collection().add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)


def add_visual_chunks(ids, embeddings, documents, metadatas):
    if ids:
        visual_collection().add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)


def delete_document(doc_id):
    for coll in (text_collection(), visual_collection()):
        try:
            coll.delete(where={"doc_id": doc_id})
        except Exception:
            pass


def stats():
    return {
        "text_vectors": text_collection().count(),
        "visual_vectors": visual_collection().count(),
    }


def sample_vectors(user_id, limit=120):
    """Return a sample of stored vectors for 2D projection."""
    out = []
    for coll, path in ((text_collection(), "text"), (visual_collection(), "visual")):
        try:
            res = coll.get(where={"user_id": user_id}, include=["embeddings", "metadatas"], limit=limit)
        except Exception:
            continue
        embs = res.get("embeddings")
        embs = [] if embs is None else list(embs)
        metas = res.get("metadatas")
        metas = [] if metas is None else list(metas)
        for i, emb in enumerate(embs):
            meta = metas[i] if i < len(metas) else {}
            out.append({"path": path, "embedding": list(emb), "meta": meta})
    return out
