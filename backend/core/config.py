"""Central environment configuration for NEXUS-RAG."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")


class Settings:
    # LLM (cloud substitution for local Ollama in this sandbox)
    EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
    LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "anthropic")
    LLM_MODEL = os.environ.get("LLM_MODEL", "claude-sonnet-4-6")

    # Local LLM Engine: "lm_studio", "ollama", or "auto"
    LOCAL_LLM_PROVIDER = os.environ.get("LOCAL_LLM_PROVIDER", "lm_studio")

    # LM Studio (OpenAI-compatible local server, default: http://localhost:1234/v1)
    LM_STUDIO_HOST = os.environ.get("LM_STUDIO_HOST", "http://localhost:1234/v1")
    LM_STUDIO_MODEL = os.environ.get("LM_STUDIO_MODEL", "qwen2.5-vl-3b")
    LM_STUDIO_VISION_MODEL = os.environ.get("LM_STUDIO_VISION_MODEL", "qwen2.5-vl-3b")

    # Local Ollama (offline deployment path — documented)
    OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "mistral:7b")

    # Vision-capable Ollama model for real image analysis (captioning/
    # description at ingestion time) — separate from OLLAMA_MODEL, which is
    # text-only. Without this, images with no printed text only ever get a
    # CLIP similarity match; the LLM never actually "sees" what's in them.
    OLLAMA_VISION_MODEL = os.environ.get("OLLAMA_VISION_MODEL", "llava:7b")
    ENABLE_IMAGE_CAPTIONING = os.environ.get("ENABLE_IMAGE_CAPTIONING", "true").lower() == "true"

    # Speech-to-text: "local" (faster-whisper, fully offline) or "cloud" (Emergent/OpenAI fallback)
    STT_PROVIDER = os.environ.get("STT_PROVIDER", "local")
    WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "base")  # tiny/base/small/medium
    WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
    WHISPER_COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")  # int8 = fastest on CPU

    # Vector store + uploads
    CHROMA_PERSIST_DIR = os.environ.get("CHROMA_PERSIST_DIR", str(ROOT_DIR / "data" / "chroma"))
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", str(ROOT_DIR / "data" / "uploads"))

    # Embedding models
    TEXT_EMBED_MODEL = os.environ.get("TEXT_EMBED_MODEL", "all-MiniLM-L6-v2")
    VISUAL_EMBED_MODEL = os.environ.get("VISUAL_EMBED_MODEL", "clip-ViT-B-32")

    # Auth
    JWT_SECRET = os.environ.get("JWT_SECRET", "")
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@nexusrag.ai")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    # Retrieval defaults
    DEFAULT_CHUNK_SIZE = 800
    DEFAULT_CHUNK_OVERLAP = 120
    DEFAULT_TOP_K = 5
    DEFAULT_RRF_TEXT_WEIGHT = 1.0
    DEFAULT_RRF_VISUAL_WEIGHT = 1.0


settings = Settings()

os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
