"""Ingestion orchestrator: parse -> chunk -> embed -> index in ChromaDB.

Runs as a FastAPI background task. Updates per-file status in Mongo so the UI can
show Queued -> Parsing -> Embedding -> Indexed / Failed in real time. Raw file
bytes are read from MongoDB (local offline store), never the pod filesystem.
"""
import uuid
import base64
from datetime import datetime, timezone

from core.db import db
from ingestion import parsers, chunking, embeddings
from retrieval import chroma_client


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _set_status(doc_id, status, **extra):
    update = {"status": status, "updated_at": _now()}
    update.update(extra)
    await db.documents.update_one({"id": doc_id}, {"$set": update})


async def _load_bytes(doc_id):
    rec = await db.document_files.find_one({"doc_id": doc_id})
    if not rec:
        return None
    return base64.b64decode(rec["content"])


async def process_document(doc_id: str):
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        return
    try:
        settings_doc = await db.user_settings.find_one({"user_id": doc["user_id"]}) or {}
        chunk_size = settings_doc.get("chunk_size", 800)
        overlap = settings_doc.get("chunk_overlap", 120)

        await _set_status(doc_id, "parsing")
        modality = doc["modality"]
        user_id = doc["user_id"]
        collection = doc.get("collection") or "default"
        filename = doc["filename"]

        data = await _load_bytes(doc_id)
        if data is None:
            await _set_status(doc_id, "failed", error="File content missing.")
            return

        text = ""
        page_images = []

        if modality == "document":
            if filename.lower().endswith(".pdf"):
                text, page_images = parsers.parse_pdf(data)
            else:
                text = parsers.parse_docx(data)
        elif modality == "image":
            img = parsers.parse_image(data)
            page_images = [img]
            ocr_text = parsers.ocr_image(img)  # "" if nothing readable
            caption = await parsers.caption_image_if_enabled(img)
            # Combine both: OCR covers printed/handwritten text (forms, IDs,
            # signs); the vision-model caption covers everything OCR can't —
            # objects, scenes, chart/diagram structure. Together they give
            # the LLM actual content to answer questions from, not just a
            # CLIP similarity match with no real understanding of the image.
            parts = [p for p in (caption, ocr_text) if p]
            text = "\n\n".join(parts)
        elif modality == "audio":
            text = await parsers.parse_audio(data, filename)

        await _set_status(doc_id, "embedding", transcript=(text[:2000] if modality == "audio" else None))

        text_ids, text_embs, text_docs, text_metas = [], [], [], []
        chunks = chunking.chunk_text(text, chunk_size, overlap) if text else []
        if chunks:
            text_embs = await embeddings.embed_texts(chunks)
            for i, ch in enumerate(chunks):
                cid = f"{doc_id}:t{i}"
                text_ids.append(cid)
                text_docs.append(ch)
                text_metas.append({
                    "doc_id": doc_id, "user_id": user_id, "collection": collection,
                    "filename": filename, "modality": modality, "chunk_index": i,
                })
        chroma_client.add_text_chunks(text_ids, text_embs, text_docs, text_metas)

        vis_ids, vis_embs, vis_docs, vis_metas = [], [], [], []
        if page_images:
            vis_embs = await embeddings.embed_images(page_images)
            for i, _img in enumerate(page_images):
                cid = f"{doc_id}:v{i}"
                preview = (text[:300] if text else f"[Image page {i + 1} of {filename}]")
                vis_ids.append(cid)
                vis_docs.append(preview)
                vis_metas.append({
                    "doc_id": doc_id, "user_id": user_id, "collection": collection,
                    "filename": filename, "modality": ("image" if modality == "image" else "document"),
                    "page": i + 1,
                })
        chroma_client.add_visual_chunks(vis_ids, vis_embs, vis_docs, vis_metas)

        chunk_count = len(text_ids) + len(vis_ids)
        if chunk_count == 0:
            await _set_status(doc_id, "failed", error="No extractable content found in file.")
            return

        await _set_status(
            doc_id, "indexed",
            chunk_count=chunk_count,
            text_chunks=len(text_ids),
            visual_chunks=len(vis_ids),
            raw_text=(text[:50000] if text else None),
        )
    except Exception as e:  # noqa: BLE001
        await _set_status(doc_id, "failed", error=str(e)[:400])


def new_doc_record(user_id, filename, modality, size, collection):
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "filename": filename,
        "modality": modality,
        "size": size,
        "collection": collection or "default",
        "status": "queued",
        "chunk_count": 0,
        "text_chunks": 0,
        "visual_chunks": 0,
        "error": None,
        "transcript": None,
        "raw_text": None,
        "created_at": _now(),
        "updated_at": _now(),
    }
