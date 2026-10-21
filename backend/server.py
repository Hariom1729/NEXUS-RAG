"""NEXUS-RAG — Offline Multimodal RAG backend (FastAPI)."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import logging
from datetime import datetime, timezone
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from core.config import settings
from core.db import db
from core.security import hash_password, verify_password
from ingestion.embeddings import warm_up
from api import (
    auth_routes, document_routes, chat_routes, dashboard_routes, system_routes, files_routes,
)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("nexus-rag")

app = FastAPI(title="NEXUS-RAG API")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "NEXUS-RAG API online", "offline_mode": True}


api_router.include_router(auth_routes.router)
api_router.include_router(document_routes.router)
api_router.include_router(chat_routes.router)
api_router.include_router(dashboard_routes.router)
api_router.include_router(system_routes.router)
api_router.include_router(files_routes.router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def seed_admin():
    email = settings.ADMIN_EMAIL.lower()
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "name": "Admin", "email": email,
            "password_hash": hash_password(settings.ADMIN_PASSWORD),
            "role": "admin", "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin user %s", email)
    elif not verify_password(settings.ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one(
            {"email": email}, {"$set": {"password_hash": hash_password(settings.ADMIN_PASSWORD)}})


@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.documents.create_index("user_id")
        await db.documents.create_index("id", unique=True)
        await db.conversations.create_index("user_id")
        await db.messages.create_index("conversation_id")
        await db.login_attempts.create_index("identifier")
    except Exception as e:  # noqa: BLE001
        logger.warning("Index creation: %s", e)
    await seed_admin()
    import threading
    threading.Thread(target=warm_up, daemon=True).start()
    logger.info("NEXUS-RAG startup complete. Chroma dir: %s", settings.CHROMA_PERSIST_DIR)


@app.on_event("shutdown")
async def shutdown():
    pass
