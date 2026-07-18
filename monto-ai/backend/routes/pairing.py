"""
Pairing Route — /pairing
Persists child<->parent device pairing in Supabase instead of only in each
device's localStorage, so pairing survives app reinstalls and multiple
parent devices can pair to the same child.

Flow:
  1. Child app calls POST /pairing/code with its own device id + connection
     info (backend URL, TURN creds) → gets back a short-lived code, shown as
     a QR ({v:2, code, api}).
  2. Parent app scans the QR, calls POST /pairing/redeem with that code + its
     own device id → gets back the full connection info and the pairing is
     recorded permanently in the `pairings` table.
"""
import logging
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pairing", tags=["pairing"])

CODE_TTL_MINUTES = 10
CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_code(length: int = 6) -> str:
    return "".join(random.choices(CODE_ALPHABET, k=length))


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateCodeRequest(BaseModel):
    child_device_id: str
    api_url: str
    turn_url: Optional[str] = None
    turn_username: Optional[str] = None
    turn_password: Optional[str] = None


class CreateCodeResponse(BaseModel):
    code: str
    expires_at: str


class RedeemCodeRequest(BaseModel):
    code: str
    parent_device_id: str


class RedeemCodeResponse(BaseModel):
    child_device_id: str
    api_url: str
    turn_url: Optional[str] = None
    turn_username: Optional[str] = None
    turn_password: Optional[str] = None


class PairedDevice(BaseModel):
    parent_device_id: str
    paired_at: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/code", response_model=CreateCodeResponse)
async def create_code(req: CreateCodeRequest):
    """Child app: register itself and mint a short-lived pairing code."""
    db = get_supabase()

    db.table("devices").upsert({
        "device_id": req.child_device_id,
        "role": "child",
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    code = _generate_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES)

    db.table("pairing_codes").insert({
        "code": code,
        "child_device_id": req.child_device_id,
        "api_url": req.api_url,
        "turn_url": req.turn_url,
        "turn_username": req.turn_username,
        "turn_password": req.turn_password,
        "expires_at": expires_at.isoformat(),
    }).execute()

    logger.info(f"[Pairing] code {code} created for child {req.child_device_id}")
    return CreateCodeResponse(code=code, expires_at=expires_at.isoformat())


@router.post("/redeem", response_model=RedeemCodeResponse)
async def redeem_code(req: RedeemCodeRequest):
    """Parent app: exchange a scanned code for connection info, and record
    the pairing permanently."""
    db = get_supabase()

    res = (
        db.table("pairing_codes")
        .select("*")
        .eq("code", req.code.upper())
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Pairing code not found")

    row = res.data[0]
    expires_at = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="Pairing code expired — generate a new QR code")

    db.table("devices").upsert({
        "device_id": req.parent_device_id,
        "role": "parent",
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    db.table("pairings").upsert({
        "child_device_id": row["child_device_id"],
        "parent_device_id": req.parent_device_id,
    }, on_conflict="child_device_id,parent_device_id").execute()

    db.table("pairing_codes").update({
        "redeemed_at": datetime.now(timezone.utc).isoformat(),
        "redeemed_by_device_id": req.parent_device_id,
    }).eq("code", row["code"]).execute()

    logger.info(f"[Pairing] {req.parent_device_id} paired with child {row['child_device_id']}")

    return RedeemCodeResponse(
        child_device_id=row["child_device_id"],
        api_url=row["api_url"],
        turn_url=row["turn_url"],
        turn_username=row["turn_username"],
        turn_password=row["turn_password"],
    )


@router.get("/status/{child_device_id}", response_model=list[PairedDevice])
async def pairing_status(child_device_id: str):
    """List every parent device currently paired with this child device."""
    db = get_supabase()
    res = (
        db.table("pairings")
        .select("parent_device_id, paired_at")
        .eq("child_device_id", child_device_id)
        .execute()
    )
    return [PairedDevice(**row) for row in (res.data or [])]


@router.delete("/{child_device_id}/{parent_device_id}")
async def unpair(child_device_id: str, parent_device_id: str):
    """Remove a pairing (e.g. parent got a new phone)."""
    db = get_supabase()
    db.table("pairings").delete().eq("child_device_id", child_device_id).eq(
        "parent_device_id", parent_device_id
    ).execute()
    return {"status": "unpaired"}
