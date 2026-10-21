"""Dual-modality embeddings.

Text path : SentenceTransformers `all-MiniLM-L6-v2` (384-d).
Visual path: CLIP `clip-ViT-B-32` (512-d) — a real CLIP-style encoder that maps
             images AND text queries into one shared semantic space.

NOTE (sandbox substitution): the original spec called for ColPali for the visual
path. ColPali requires a GPU + multi-GB weights and cannot run in this CPU sandbox,
so a lighter CLIP-style encoder is used instead. This is a documented substitution,
not the original stack presented as-is.
"""
import asyncio
from core.config import settings

_text_model = None
_clip_model = None


def _load_text():
    global _text_model
    if _text_model is None:
        from sentence_transformers import SentenceTransformer
        _text_model = SentenceTransformer(settings.TEXT_EMBED_MODEL)
    return _text_model


def _load_clip():
    global _clip_model
    if _clip_model is None:
        from sentence_transformers import SentenceTransformer
        _clip_model = SentenceTransformer(settings.VISUAL_EMBED_MODEL)
    return _clip_model


def _embed_texts_sync(texts):
    return _load_text().encode(texts, normalize_embeddings=True).tolist()


def _embed_images_sync(images):
    return _load_clip().encode(images, normalize_embeddings=True).tolist()


def _embed_clip_text_sync(texts):
    return _load_clip().encode(texts, normalize_embeddings=True).tolist()


async def embed_texts(texts):
    return await asyncio.to_thread(_embed_texts_sync, texts)


async def embed_images(images):
    return await asyncio.to_thread(_embed_images_sync, images)


async def embed_clip_text(texts):
    return await asyncio.to_thread(_embed_clip_text_sync, texts)


def warm_up():
    """Pre-load both encoders so the first request is fast."""
    _load_text()
    _load_clip()
