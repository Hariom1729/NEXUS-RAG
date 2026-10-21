"""LLM generation.

PRIMARY PATH (offline deployments — Docker/local): streams from a local LLM runner:
1. LM Studio (OpenAI-compatible server on http://localhost:1234/v1)
2. Ollama (native server on http://localhost:11434)

OPTIONAL FALLBACK: a cloud model via the Emergent Universal Key.
"""
from core.config import settings
from llm.prompts import SYSTEM_PROMPT
from llm import ollama_client, lm_studio_client


async def stream_answer(
    session_id,
    user_prompt,
    host=None,
    model=None,
    history=None,
    provider=None,
):
    """Yield answer tokens. Supports LM Studio and Ollama, falling back to cloud key if configured."""
    prov = provider or settings.LOCAL_LLM_PROVIDER

    # 1. Check LM Studio if selected or auto
    if prov in ("lm_studio", "auto"):
        lm_host = host if prov == "lm_studio" else None
        lm_model = model if prov == "lm_studio" else None
        if await lm_studio_client.is_available(lm_host):
            async for tok in lm_studio_client.stream_chat(SYSTEM_PROMPT, history, user_prompt, lm_host, lm_model):
                yield tok
            return

    # 2. Check Ollama if selected or auto
    if prov in ("ollama", "auto"):
        ol_host = host if prov == "ollama" else None
        ol_model = model if prov == "ollama" else None
        if await ollama_client.is_available(ol_host):
            async for tok in ollama_client.stream_chat(SYSTEM_PROMPT, history, user_prompt, ol_host, ol_model):
                yield tok
            return

    # 3. Fallback: Check if LM Studio is up even if ollama was preferred
    if prov == "ollama" and await lm_studio_client.is_available():
        async for tok in lm_studio_client.stream_chat(SYSTEM_PROMPT, history, user_prompt):
            yield tok
        return

    # 4. Fallback: Check if Ollama is up even if LM Studio was preferred
    if prov == "lm_studio" and await ollama_client.is_available():
        async for tok in ollama_client.stream_chat(SYSTEM_PROMPT, history, user_prompt):
            yield tok
        return

    # 5. Cloud fallback (Emergent Universal Key, if present)
    if not settings.EMERGENT_LLM_KEY:
        yield (
            "No local LLM is reachable (neither LM Studio on http://localhost:1234/v1 "
            "nor Ollama on http://localhost:11434). Please start LM Studio's Local Server "
            "or Ollama, verify the model is loaded, and try again."
        )
        return

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
    except ImportError:
        yield (
            "Neither LM Studio nor Ollama is reachable and the cloud fallback package "
            "(emergentintegrations) is not installed in this environment. "
            "Start your LM Studio server at http://localhost:1234/v1 to get offline answers."
        )
        return

    chat = LlmChat(
        api_key=settings.EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model(settings.LLM_PROVIDER, settings.LLM_MODEL)

    async for ev in chat.stream_message(UserMessage(text=user_prompt)):
        if isinstance(ev, TextDelta):
            yield ev.content
        elif isinstance(ev, StreamDone):
            break


async def active_backend(host=None, model=None, provider=None):
    prov = provider or settings.LOCAL_LLM_PROVIDER

    # LM Studio check
    if prov in ("lm_studio", "auto"):
        lm_host = host if prov == "lm_studio" else None
        lm_model = model if prov == "lm_studio" else None
        if await lm_studio_client.is_available(lm_host):
            stat = await lm_studio_client.status(lm_host, lm_model)
            return {
                "mode": "lm_studio",
                "model": stat.get("model") or lm_model or settings.LM_STUDIO_MODEL,
                "endpoint": stat.get("host") or lm_host or settings.LM_STUDIO_HOST,
                "note": "LM Studio local inference active (OpenAI-compatible /v1).",
                "available_models": stat.get("available_models", []),
            }

    # Ollama check
    if prov in ("ollama", "auto"):
        ol_host = host if prov == "ollama" else None
        ol_model = model if prov == "ollama" else None
        if await ollama_client.is_available(ol_host):
            stat = await ollama_client.status(ol_host, ol_model)
            return {
                "mode": "ollama",
                "model": stat.get("model") or ol_model or settings.OLLAMA_MODEL,
                "endpoint": stat.get("host") or ol_host or settings.OLLAMA_HOST,
                "note": "Ollama local inference active.",
                "available_models": stat.get("available_models", []),
            }

    # Alternate check if preferred was offline
    if await lm_studio_client.is_available():
        stat = await lm_studio_client.status()
        return {
            "mode": "lm_studio",
            "model": stat.get("model") or settings.LM_STUDIO_MODEL,
            "endpoint": stat.get("host") or settings.LM_STUDIO_HOST,
            "note": "LM Studio local inference active (auto-fallback).",
            "available_models": stat.get("available_models", []),
        }

    if await ollama_client.is_available():
        stat = await ollama_client.status()
        return {
            "mode": "ollama",
            "model": stat.get("model") or settings.OLLAMA_MODEL,
            "endpoint": stat.get("host") or settings.OLLAMA_HOST,
            "note": "Ollama local inference active (auto-fallback).",
            "available_models": stat.get("available_models", []),
        }

    if settings.EMERGENT_LLM_KEY:
        return {
            "mode": "cloud_substitution",
            "model": f"{settings.LLM_PROVIDER}/{settings.LLM_MODEL}",
            "endpoint": "emergent-universal-key",
            "note": "Local LLM unreachable; using cloud fallback model.",
        }

    return {
        "mode": "unavailable",
        "model": None,
        "endpoint": None,
        "note": "No local LLM reachable (LM Studio on :1234 or Ollama on :11434).",
    }

