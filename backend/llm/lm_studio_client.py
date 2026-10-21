"""LM Studio client — local OpenAI-compatible inference path.

Connects to LM Studio's local server (default: http://localhost:1234/v1).
Supports streaming chat completions, model listing, health checks,
and multimodal vision captioning.
"""
import json
import httpx
from core.config import settings


def _normalize_host(host: str | None) -> str:
    h = (host or settings.LM_STUDIO_HOST).rstrip("/")
    if not h.endswith("/v1"):
        h = f"{h}/v1"
    return h


def _model(model: str | None) -> str:
    return model or settings.LM_STUDIO_MODEL


async def is_available(host: str | None = None) -> bool:
    h = _normalize_host(host)
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"{h}/models")
            return r.status_code == 200
    except Exception:
        return False


async def status(host: str | None = None, model: str | None = None) -> dict:
    h = _normalize_host(host)
    m = _model(model)
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{h}/models")
            if r.status_code == 200:
                raw_models = r.json().get("data", [])
                models = [x.get("id") for x in raw_models if x.get("id")]
                # If m is specified, check if it's available or if any model is loaded
                loaded = (m in models) or (len(models) > 0 and (not m or m == "auto"))
                effective_model = m if (m and m in models) else (models[0] if models else m)
                return {
                    "reachable": True,
                    "host": h,
                    "model": effective_model,
                    "loaded": loaded,
                    "available_models": models,
                }
    except Exception:
        pass
    return {
        "reachable": False,
        "host": h,
        "model": m,
        "loaded": False,
        "available_models": [],
    }


async def stream_chat(
    system_prompt: str,
    history: list,
    user_prompt: str,
    host: str | None = None,
    model: str | None = None,
):
    """Multi-turn streaming chat via OpenAI-compatible /v1/chat/completions."""
    h = _normalize_host(host)
    m = _model(model)

    messages = [{"role": "system", "content": system_prompt}]
    messages += [item for item in (history or []) if item.get("content")]
    messages.append({"role": "user", "content": user_prompt})

    payload = {
        "model": m,
        "messages": messages,
        "stream": True,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", f"{h}/chat/completions", json=payload) as resp:
            if resp.status_code != 200:
                err_text = await resp.aread()
                yield f"[LM Studio Error {resp.status_code}]: {err_text.decode('utf-8', errors='ignore')}"
                return

            async for line in resp.aiter_lines():
                if not line:
                    continue
                line_str = line.strip()
                if line_str == "data: [DONE]":
                    break
                if line_str.startswith("data: "):
                    data_json = line_str[6:].strip()
                    try:
                        data = json.loads(data_json)
                    except Exception:
                        continue
                    choices = data.get("choices", [])
                    if choices:
                        delta = choices[0].get("delta", {})
                        token = delta.get("content")
                        if token:
                            yield token


async def caption_image(
    image_b64: str,
    host: str | None = None,
    vision_model: str | None = None,
) -> str:
    """Analyze image using a vision-capable model loaded in LM Studio."""
    h = _normalize_host(host)
    m = vision_model or settings.LM_STUDIO_VISION_MODEL or _model(None)

    payload = {
        "model": m,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Describe this image factually and specifically: what it shows, "
                            "any objects/people/scenes, and if it's a chart, diagram, or "
                            "table, describe its structure and key data points. Be concise "
                            "(2-4 sentences), no speculation beyond what's visible."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                ],
            }
        ],
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(f"{h}/chat/completions", json=payload)
            if r.status_code == 200:
                choices = r.json().get("choices", [])
                if choices:
                    return (choices[0].get("message", {}).get("content") or "").strip()
    except Exception:
        pass
    return ""
