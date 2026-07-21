"""
Supabase client — single shared connection to the project's Postgres DB.
Uses the service_role key because this runs server-side only (never expose
that key to frontend/parent-app — they go through this backend's REST API).
"""
import os
import logging
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


def get_supabase() -> Client:
    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise RuntimeError("NO_SUPABASE")  # caught by memory_service for SQLite fallback

    _client = create_client(url, key)
    logger.info("✅ Supabase client ready")
    return _client
