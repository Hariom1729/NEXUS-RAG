FROM python:3.12-slim

# System deps: libgl/libglib for PyMuPDF & Pillow image handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 curl tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# requirements.txt pins torch==...+cpu, a build variant that only exists on
# PyTorch's own index, not default PyPI — so we add it as an extra index.
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt

# ---- Pre-bake all model weights at BUILD time, not at user first-run ----
# This is what makes the packaged app genuinely offline from container start:
# no model download happens on the user's machine.

# 1. Text + visual embedding models (sentence-transformers / CLIP)
ARG TEXT_EMBED_MODEL=all-MiniLM-L6-v2
ARG VISUAL_EMBED_MODEL=clip-ViT-B-32
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('${TEXT_EMBED_MODEL}'); \
SentenceTransformer('${VISUAL_EMBED_MODEL}')"

# 2. Whisper STT model (faster-whisper) — default 'base', override with
#    --build-arg WHISPER_MODEL_SIZE=small for higher accuracy if the target
#    machine can afford the extra ~500MB and slower per-file transcription.
ARG WHISPER_MODEL_SIZE=base
RUN python -c "\
from faster_whisper import WhisperModel; \
WhisperModel('${WHISPER_MODEL_SIZE}', device='cpu', compute_type='int8')"

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD curl -f http://localhost:8000/api/ || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
