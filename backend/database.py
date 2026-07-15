"""Infra layer. The ONLY module that knows about MongoDB.
Swapping to PostgreSQL/Supabase later means rewriting only this file + repository.py.
Services never import motor directly."""
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _client[os.environ["DB_NAME"]]


def get_db():
    return _db


def close_client():
    _client.close()
