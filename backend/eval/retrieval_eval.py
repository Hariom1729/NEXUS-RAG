"""Retrieval evaluation — Recall@K and MRR against a labeled query set.

This runs each eval query through the SAME retrieval path chat uses
(embed -> query_text/query_visual -> rrf_fuse), so the numbers reflect
the actual configured pipeline (chunking, top_k, RRF weights), not a
separate/idealized eval-only path.

No numbers are fabricated: with zero eval queries provided, callers get
an explicit "not_configured" response (see api/system_routes.py), never
a silently-empty or made-up metric.
"""
from ingestion import embeddings
from retrieval import chroma_client
from retrieval.rrf import rrf_fuse


async def _retrieve_doc_ids(query: str, user_id: str, top_k: int,
                             rrf_text_weight: float, rrf_visual_weight: float,
                             collection: str | None = None) -> list[str]:
    """Run one query through the real pipeline; return ranked doc_ids (not chunk ids)."""
    [text_emb] = await embeddings.embed_texts([query])
    text_hits = chroma_client.query_text(text_emb, top_k * 3, user_id, collection)

    try:
        [clip_emb] = await embeddings.embed_clip_text([query])
        visual_hits = chroma_client.query_visual(clip_emb, top_k * 3, user_id, collection)
    except Exception:
        visual_hits = []

    fused = rrf_fuse(text_hits, visual_hits,
                      w_text=rrf_text_weight, w_visual=rrf_visual_weight)

    ranked_doc_ids = []
    for hit in fused:
        doc_id = hit.get("metadata", {}).get("doc_id")
        if doc_id and doc_id not in ranked_doc_ids:
            ranked_doc_ids.append(doc_id)
        if len(ranked_doc_ids) >= top_k:
            break
    return ranked_doc_ids


def _recall_at_k(ranked_doc_ids: list[str], relevant_doc_ids: list[str]) -> float:
    if not relevant_doc_ids:
        return 0.0
    hit_count = sum(1 for d in relevant_doc_ids if d in ranked_doc_ids)
    return hit_count / len(relevant_doc_ids)


def _reciprocal_rank(ranked_doc_ids: list[str], relevant_doc_ids: list[str]) -> float:
    for rank, doc_id in enumerate(ranked_doc_ids, start=1):
        if doc_id in relevant_doc_ids:
            return 1.0 / rank
    return 0.0


async def run_eval(eval_set: list[dict], user_id: str, top_k: int = 5,
                    rrf_text_weight: float = 1.0, rrf_visual_weight: float = 1.0,
                    collection: str | None = None) -> dict:
    """eval_set: [{"query": str, "relevant_doc_ids": [str, ...]}, ...]"""
    per_query = []
    for item in eval_set:
        query = item["query"]
        relevant = item.get("relevant_doc_ids", [])
        ranked = await _retrieve_doc_ids(
            query, user_id, top_k, rrf_text_weight, rrf_visual_weight, collection)
        recall = _recall_at_k(ranked, relevant)
        rr = _reciprocal_rank(ranked, relevant)
        per_query.append({
            "query": query,
            "relevant_doc_ids": relevant,
            "retrieved_doc_ids": ranked,
            "recall_at_k": round(recall, 4),
            "reciprocal_rank": round(rr, 4),
        })

    n = len(per_query) or 1
    recall_at_5 = sum(p["recall_at_k"] for p in per_query) / n
    mrr = sum(p["reciprocal_rank"] for p in per_query) / n

    return {
        "status": "ok",
        "recall_at_5": round(recall_at_5, 4),
        "mrr": round(mrr, 4),
        "num_queries": len(per_query),
        "top_k": top_k,
        "per_query": per_query,
    }
