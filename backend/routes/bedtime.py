"""
Bedtime Route — /bedtime
Schedule storage only for this MVP — no lock/enforcement on the child device
yet. One schedule per child device, upserted from the parent app.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bedtime", tags=["bedtime"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class BedtimeUpdate(BaseModel):
    start_time: str
    end_time: str
    enabled: bool


class BedtimeOut(BaseModel):
    child_device_id: str
    start_time: str
    end_time: str
    enabled: bool
    updated_at: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{device_id}", response_model=BedtimeOut)
async def get_bedtime(device_id: str):
    """Parent app: load the saved bedtime schedule, or a disabled default if
    none has been saved yet (so the first-load UX doesn't need to special-case
    a 404)."""
    db = get_supabase()
    res = (
        db.table("bedtime_schedules")
        .select("*")
        .eq("child_device_id", device_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]

    return {
        "child_device_id": device_id,
        "start_time": "20:00",
        "end_time": "07:00",
        "enabled": False,
        "updated_at": None,
    }


@router.put("/{device_id}", response_model=BedtimeOut)
async def save_bedtime(device_id: str, req: BedtimeUpdate):
    """Parent app: create or update the bedtime schedule for this device."""
    db = get_supabase()
    res = (
        db.table("bedtime_schedules")
        .upsert({
            "child_device_id": device_id,
            "start_time": req.start_time,
            "end_time": req.end_time,
            "enabled": req.enabled,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="child_device_id")
        .execute()
    )
    return res.data[0]
