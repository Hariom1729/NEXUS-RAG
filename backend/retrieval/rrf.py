"""Reciprocal Rank Fusion of the text-path and visual-path result lists."""


def rrf_fuse(text_hits, visual_hits, k=60, w_text=1.0, w_visual=1.0):
    scores = {}
    store = {}
    contrib = {}

    for rank, hit in enumerate(text_hits):
        cid = hit["id"]
        s = w_text * (1.0 / (k + rank + 1))
        scores[cid] = scores.get(cid, 0.0) + s
        store[cid] = hit
        contrib.setdefault(cid, {})["text_rank"] = rank + 1

    for rank, hit in enumerate(visual_hits):
        cid = hit["id"]
        s = w_visual * (1.0 / (k + rank + 1))
        scores[cid] = scores.get(cid, 0.0) + s
        store.setdefault(cid, hit)
        contrib.setdefault(cid, {})["visual_rank"] = rank + 1

    fused = sorted(scores.items(), key=lambda x: -x[1])
    result = []
    for cid, sc in fused:
        item = dict(store[cid])
        item["rrf_score"] = round(sc, 6)
        item["text_rank"] = contrib[cid].get("text_rank")
        item["visual_rank"] = contrib[cid].get("visual_rank")
        result.append(item)
    return result
