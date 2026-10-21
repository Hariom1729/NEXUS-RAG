"""MongoDB connection (metadata store — offline local instance)."""
import os
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "nexus_rag")

_client = AsyncIOMotorClient(mongo_url)
db = _client[db_name]


def get_db():
    return db
