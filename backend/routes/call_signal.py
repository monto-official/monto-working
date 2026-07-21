"""
Call Signaling — HTTP polling (/call/{room_id}/...)
Replaces the old persistent-WebSocket signaling (/ws/call) for actual
ring/accept/offer/answer/ice-candidate exchange. That socket was observed to
silently drop every few seconds on some networks, taking whatever message
was in flight with it. Plain HTTP request/response can't "drop a
connection" the same way — a failed poll just retries on the next tick, and
once a POST to /signal succeeds the message is durably stored and WILL be
seen on the peer's next poll.

The actual call media still goes over WebRTC directly between the two
devices (or via TURN) — this only replaces how they exchange the handshake
messages needed to set that up. The parent/child control channel used for
music/pairing notifications is unrelated and still uses /ws/call.

Flow:
  - Both sides poll GET /call/{room_id}/poll?role=<mine>&after_id=<last>
    every ~1s. Polling doubles as a heartbeat (see `call_presence`), so the
    response also reports whether the peer is currently online.
  - Either side posts a signal with POST /call/{room_id}/signal.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/call", tags=["call-signal"])

PRESENCE_FRESH_SECONDS = 6
ROLES = ("child", "parent")


def _other_role(role: str) -> str:
    return "parent" if role == "child" else "child"


# ── Schemas ───────────────────────────────────────────────────────────────────

class SignalRequest(BaseModel):
    role: str
    type: str
    payload: Dict[str, Any] = {}


class SignalOut(BaseModel):
    id: int
    role: str
    type: str
    payload: Dict[str, Any]


class PollResponse(BaseModel):
    signals: List[SignalOut]
    peer_online: bool
    latest_id: int


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/{room_id}/signal")
async def send_signal(room_id: str, req: SignalRequest):
    if req.role not in ROLES:
        raise HTTPException(status_code=400, detail="role must be 'child' or 'parent'")

    db = get_supabase()

    # A fresh "ring" starts a new call attempt — clear old signals for this
    # room so repeated attempts don't pile up, and open a new call_logs row
    # the same way the old WS relay did.
    if req.type == "ring":
        try:
            db.table("call_signals").delete().eq("room_id", room_id).execute()
        except Exception as exc:
            logger.warning(f"[CallSignal] clearing old signals failed (non-fatal): {exc}")
        try:
            db.table("call_logs").insert({"child_device_id": room_id, "status": "ringing"}).execute()
        except Exception as exc:
            logger.warning(f"[CallSignal] call_logs insert failed (non-fatal): {exc}")
    elif req.type in ("accept", "reject", "hangup"):
        status_map = {"accept": "connected", "reject": "rejected", "hangup": "ended"}
        try:
            update: Dict[str, Any] = {"status": status_map[req.type]}
            if req.type in ("reject", "hangup"):
                update["ended_at"] = datetime.now(timezone.utc).isoformat()
            db.table("call_logs").update(update).eq("child_device_id", room_id).is_("ended_at", "null").execute()
        except Exception as exc:
            logger.warning(f"[CallSignal] call_logs update failed (non-fatal): {exc}")

    db.table("call_signals").insert({
        "room_id": room_id,
        "role": req.role,
        "type": req.type,
        "payload": req.payload,
    }).execute()

    return {"ok": True}


@router.get("/{room_id}/poll", response_model=PollResponse)
async def poll(room_id: str, role: str, after_id: int = 0):
    if role not in ROLES:
        raise HTTPException(status_code=400, detail="role must be 'child' or 'parent'")

    db = get_supabase()
    now = datetime.now(timezone.utc)

    # Polling IS the heartbeat — whoever's asking is, by definition, online.
    db.table("call_presence").upsert({
        "room_id": room_id,
        "role": role,
        "last_seen_at": now.isoformat(),
    }, on_conflict="room_id,role").execute()

    peer_role = _other_role(role)

    presence_res = (
        db.table("call_presence")
        .select("last_seen_at")
        .eq("room_id", room_id)
        .eq("role", peer_role)
        .limit(1)
        .execute()
    )
    peer_online = False
    if presence_res.data:
        last_seen = datetime.fromisoformat(presence_res.data[0]["last_seen_at"].replace("Z", "+00:00"))
        peer_online = (now - last_seen) <= timedelta(seconds=PRESENCE_FRESH_SECONDS)

    signals_res = (
        db.table("call_signals")
        .select("id, role, type, payload")
        .eq("room_id", room_id)
        .eq("role", peer_role)
        .gt("id", after_id)
        .order("id")
        .execute()
    )
    signals = signals_res.data or []
    latest_id = signals[-1]["id"] if signals else after_id

    return PollResponse(signals=signals, peer_online=peer_online, latest_id=latest_id)
