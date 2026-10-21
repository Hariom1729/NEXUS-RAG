"""File parsers for the four modalities — operate on in-memory bytes.

Files are stored in MongoDB (local, offline datastore), never on the pod
filesystem, so parsers accept raw bytes and use in-memory streams.

- PDF  : text via PyMuPDF + page-image render for the visual path
- DOCX : text via python-docx
- Image: PIL image for the visual (CLIP) path
- Audio: transcript via faster-whisper, running fully local/offline on CPU
         (falls back to the OpenAI whisper-1 cloud path only if
         STT_PROVIDER=cloud is explicitly set, e.g. for sandbox demos)
"""
import os
import io
import base64
from PIL import Image

from core.config import settings

_whisper_model = None  # lazily loaded, cached across calls so the model
                        # (several hundred MB) is only loaded into memory once


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel

        _whisper_model = WhisperModel(
            settings.WHISPER_MODEL_SIZE,
            device=settings.WHISPER_DEVICE,
            compute_type=settings.WHISPER_COMPUTE_TYPE,
        )
    return _whisper_model

SUPPORTED = {
    ".pdf": "document",
    ".docx": "document",
    ".doc": "document",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".wav": "audio",
    ".mp3": "audio",
    ".m4a": "audio",
}


def detect_modality(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return SUPPORTED.get(ext, "unsupported")


def parse_pdf(data: bytes):
    """Return (full_text, [PIL page images]).
    Includes automatic OCR fallback for scanned or image-based PDF pages.
    """
    import fitz  # PyMuPDF

    text_parts = []
    page_images = []
    doc = fitz.open(stream=data, filetype="pdf")
    for page in doc:
        page_txt = (page.get_text("text") or "").strip()
        pix = page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3))
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        page_images.append(img)

        # Automatic OCR fallback: if page has little or no text (e.g. scanned doc, invoice, image),
        # run OCR on the rendered page image so no data is missed.
        if len(page_txt) < 30:
            try:
                ocr_txt = ocr_image(img).strip()
                if ocr_txt:
                    page_txt = f"{page_txt}\n{ocr_txt}".strip() if page_txt else ocr_txt
            except Exception:
                pass
        text_parts.append(page_txt)
    doc.close()
    return "\n\n".join(tp for tp in text_parts if tp), page_images


def parse_docx(data: bytes) -> str:
    import docx

    d = docx.Document(io.BytesIO(data))
    return "\n".join(p.text for p in d.paragraphs if p.text.strip())


def parse_image(data: bytes):
    return Image.open(io.BytesIO(data)).convert("RGB")


def ocr_image(img) -> str:
    """Extract printed/handwritten text from an image via Tesseract — fully
    offline, no model download (ships its own trained data as an apt
    package). Without this, images only get a CLIP visual-similarity match;
    the LLM never actually sees text printed on IDs, forms, signs, etc.

    Runs OCR twice — on the raw image AND on a preprocessed version
    (grayscale, upscale, denoise, adaptive threshold) — then combines both.
    This matters: preprocessing meaningfully helps noisy/skewed photographed
    documents (e.g. photographed grade cards) but was verified to actively
    HURT extraction on cleaner scans (e.g. a flat ID card photo) where raw
    OCR alone worked better. Combining both avoids regressing either case.

    Known limitation: small numeric text in busy tables on low-quality
    photos can still OCR imperfectly (e.g. "8.8" misread as "88") — for
    documents where exact figures matter, a flatter, well-lit photo or a
    real scan will extract far more reliably than a tilted phone photo.
    """
    import pytesseract
    import numpy as np

    img = img.convert("RGB")
    try:
        raw_text = pytesseract.image_to_string(img).strip()
    except Exception:
        raw_text = ""

    processed_text = ""
    try:
        import cv2
        arr = np.array(img)
        gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
        h, w = gray.shape
        gray = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
        gray = cv2.fastNlMeansDenoising(gray, h=15)
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11
        )
        from PIL import Image as PILImage
        processed = PILImage.fromarray(thresh)
        processed_text = pytesseract.image_to_string(processed, config="--psm 6").strip()
    except Exception:
        pass  # cv2 preprocessing unavailable/failed — raw_text still stands

    combined = "\n".join(t for t in (raw_text, processed_text) if t)
    return combined.strip()


async def caption_image_if_enabled(img) -> str:
    """Real image content analysis via a local vision model (LM Studio or Ollama).
    Returns "" (not an error) if disabled or unreachable — ingestion always
    proceeds with whatever OCR text is available rather than failing the whole upload."""
    if not settings.ENABLE_IMAGE_CAPTIONING:
        return ""
    try:
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=85)
        img_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        # Try LM Studio first if configured or available
        from llm import lm_studio_client, ollama_client
        if settings.LOCAL_LLM_PROVIDER in ("lm_studio", "auto") and await lm_studio_client.is_available():
            cap = await lm_studio_client.caption_image(img_b64)
            if cap:
                return cap

        if await ollama_client.is_available(settings.OLLAMA_HOST):
            return await ollama_client.caption_image(
                img_b64, settings.OLLAMA_HOST, settings.OLLAMA_VISION_MODEL
            )
    except Exception:
        return ""


async def parse_audio(data: bytes, filename: str) -> str:
    """Entry point used by the ingestion pipeline for the "audio" modality.

    Routes to the fully-offline faster-whisper transcription path by
    default, or the cloud fallback only when STT_PROVIDER=cloud is
    explicitly set.
    """
    if settings.STT_PROVIDER == "cloud":
        return await _parse_audio_cloud(data, filename)
    return await _parse_audio_local(data, filename)


async def _parse_audio_local(data: bytes, filename: str) -> str:
    """Fully offline transcription via faster-whisper (CTranslate2, CPU-friendly)."""
    import asyncio
    import tempfile

    def _transcribe():
        model = _get_whisper_model()
        # faster-whisper reads from a file path, not an in-memory stream,
        # so we spool the bytes to a short-lived temp file.
        suffix = os.path.splitext(filename)[1] or ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
            tmp.write(data)
            tmp.flush()
            segments, _info = model.transcribe(tmp.name, beam_size=5)
            return " ".join(seg.text.strip() for seg in segments)

    # transcribe() is CPU-bound and blocking; run it off the event loop
    return await asyncio.to_thread(_transcribe)


async def _parse_audio_cloud(data: bytes, filename: str) -> str:
    """Cloud fallback (OpenAI whisper-1 via Emergent key) — kept only for
    environments without local model access, e.g. this sandbox."""
    from emergentintegrations.llm.openai import OpenAISpeechToText

    stt = OpenAISpeechToText(api_key=settings.EMERGENT_LLM_KEY)
    bio = io.BytesIO(data)
    bio.name = filename
    resp = await stt.transcribe(file=bio, model="whisper-1", response_format="json")
    return resp.text
