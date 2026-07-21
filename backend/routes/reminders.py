"""
Reminders Route — /reminders
Parent-configured reminders (e.g. "drink water at 4pm"), delivered to the
child device by 60s polling (no push channel for this MVP). CRUD is owned
entirely by the parent app; the child app only ever reads.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reminders", tags=["reminders"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ReminderCreate(BaseModel):
    label: str
    time: str
    days_of_week: List[int]
    active: bool = True


class ReminderUpdate(BaseModel):
    label: Optional[str] = None
    time: Optional[str] = None
    days_of_week: Optional[List[int]] = None
    active: Optional[bool] = None


class ReminderOut(BaseModel):
    id: str
    label: str
    time: str
    days_of_week: List[int]
    active: bool
    created_at: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{device_id}", response_model=list[ReminderOut])
async def list_reminders(device_id: str):
    """List every reminder configured for this child device."""
    db = get_supabase()
    res = (
        db.table("reminders")
        .select("*")
        .eq("child_device_id", device_id)
        .execute()
    )
    return res.data or []


@router.post("/{device_id}", response_model=ReminderOut)
async def create_reminder(device_id: str, req: ReminderCreate):
    """Parent app: create a new reminder for this child device."""
    db = get_supabase()
    res = (
        db.table("reminders")
        .insert({
            "child_device_id": device_id,
            "label": req.label,
            "time": req.time,
            "days_of_week": req.days_of_week,
            "active": req.active,
        })
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create reminder")
    return res.data[0]


@router.patch("/{device_id}/{reminder_id}", response_model=ReminderOut)
async def update_reminder(device_id: str, reminder_id: str, req: ReminderUpdate):
    """Parent app: partially update a reminder (e.g. toggle active, edit fields)."""
    db = get_supabase()
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = (
        db.table("reminders")
        .update(updates)
        .eq("child_device_id", device_id)
        .eq("id", reminder_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return res.data[0]


@router.delete("/{device_id}/{reminder_id}")
async def delete_reminder(device_id: str, reminder_id: str):
    """Parent app: delete a reminder."""
    db = get_supabase()
    db.table("reminders").delete().eq("child_device_id", device_id).eq(
        "id", reminder_id
    ).execute()
    return {"status": "deleted"}
