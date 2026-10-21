"""Pydantic v2 request/response schemas."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any, Dict

from core.config import settings as app_settings


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: str


class SettingsModel(BaseModel):
    chunk_size: int = 800
    chunk_overlap: int = 120
    top_k: int = 5
    rrf_text_weight: float = 1.0
    rrf_visual_weight: float = 1.0
    local_llm_provider: str = app_settings.LOCAL_LLM_PROVIDER
    lm_studio_host: str = app_settings.LM_STUDIO_HOST
    lm_studio_model: str = app_settings.LM_STUDIO_MODEL
    ollama_host: str = app_settings.OLLAMA_HOST
    ollama_model: str = app_settings.OLLAMA_MODEL


class ChatRequest(BaseModel):
    question: str = Field(min_length=1)
    conversation_id: Optional[str] = None
    collection: Optional[str] = None


class CollectionRename(BaseModel):
    collection: str


class EvalQuery(BaseModel):
    query: str = Field(min_length=1)
    relevant_doc_ids: List[str] = Field(default_factory=list)


class EvalRequest(BaseModel):
    eval_set: List[EvalQuery]
    top_k: int = 5
    collection: Optional[str] = None
