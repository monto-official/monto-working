"""
WebRTC Signaling — /ws/call
Simple room-based WebSocket relay.
  - child connects as role="child"
  - parent connects as role="parent"
  - Both sides also pass a `room` query param — a per-family pairing/sync ID
    (see MONTO_DEVICE_ID in .env) — so the same backend can host more than
    one family's calls in isolation. Defaults to DEFAULT_ROOM_ID for existing
    single-family deployments that don't set one.
  - All messages are relayed between the two peers in the same room
  - Supports: offer, answer, ice-candidate, ring, accept, reject, hangup
  - Call start/end is best-effort logged to Supabase's call_logs table (see
    backend/supabase/schema.sql) — failures there never break call relay.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter()

# room_id -> {"child": ws, "parent": ws, "call_log_id": Optional[str]}
rooms: Dict[str, Dict[str, Optional[object]]] = {}

DEFAULT_ROOM_ID = "monto-room"   # used when no pairing/sync ID is provided


async def _log_call_start(room_id: str) -> Optional[str]:
    def _insert():
        db = get_supabase()
        res = db.table("call_logs").insert({
            "child_device_id": room_id,
            "status": "ringing",
        }).execute()
        return res.data[0]["id"] if res.data else None

    try:
        return await asyncio.get_event_loop().run_in_executor(None, _insert)
    except Exception as exc:
        logger.warning(f"[Signaling] call_logs insert failed (non-fatal): {exc}")
        return None


async def _log_call_update(call_log_id: Optional[str], status: str, *, ended: bool = False):
    if not call_log_id:
        return

    def _update():
        db = get_supabase()
        payload = {"status": status}
        if ended:
            payload["ended_at"] = datetime.now(timezone.utc).isoformat()
        db.table("call_logs").update(payload).eq("id", call_log_id).execute()

    try:
        await asyncio.get_event_loop().run_in_executor(None, _update)
    except Exception as exc:
        logger.warning(f"[Signaling] call_logs update failed (non-fatal): {exc}")


@router.websocket("/ws/call")
async def call_signaling(websocket: WebSocket, role: str = "child", room: str = DEFAULT_ROOM_ID):
    await websocket.accept()

    room_id = room or DEFAULT_ROOM_ID

    if room_id not in rooms:
        rooms[room_id] = {"child": None, "parent": None, "call_log_id": None}

    room_state = rooms[room_id]

    if role not in ("child", "parent"):
        await websocket.close(code=4000, reason="invalid role")
        return

    room_state[role] = websocket
    peer_role = "parent" if role == "child" else "child"
    logger.info(f"[Signaling] {role} joined room {room_id}")

    # Notify both sides when the other peer is already present.
    peer = room_state.get(peer_role)
    if peer:
        try:
            await peer.send_text(json.dumps({"type": "peer-online", "role": role}))
            await websocket.send_text(json.dumps({"type": "peer-online", "role": peer_role}))
        except Exception:
            room_state[peer_role] = None
            pass

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            logger.debug(f"[Signaling] {role} -> {peer_role}: {msg.get('type')}")

            msg_type = msg.get("type")
            if msg_type == "ring":
                room_state["call_log_id"] = await _log_call_start(room_id)
            elif msg_type == "accept":
                await _log_call_update(room_state.get("call_log_id"), "connected")
            elif msg_type == "reject":
                await _log_call_update(room_state.get("call_log_id"), "rejected", ended=True)
            elif msg_type == "hangup":
                await _log_call_update(room_state.get("call_log_id"), "ended", ended=True)

            # Relay message to the other peer
            peer = room_state.get(peer_role)
            if peer:
                try:
                    await peer.send_text(json.dumps({**msg, "from": role}))
                except Exception:
                    logger.warning(f"[Signaling] failed to relay to {peer_role}")
                    room_state[peer_role] = None
                    if msg_type == "ring":
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Parent app is not connected. Open the parent app first."
                        }))
            else:
                # Peer not connected — let caller know
                if msg_type == "ring":
                    await _log_call_update(room_state.get("call_log_id"), "missed", ended=True)
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Parent app is not connected. Open the parent app first."
                    }))

    except WebSocketDisconnect:
        room_state[role] = None
        logger.info(f"[Signaling] {role} left room {room_id}")

        # If a call was still active when this side dropped, close it out.
        await _log_call_update(room_state.get("call_log_id"), "ended", ended=True)
        room_state["call_log_id"] = None

        # Notify peer about disconnect
        peer = room_state.get(peer_role)
        if peer:
            try:
                await peer.send_text(json.dumps({"type": "peer-offline", "role": role}))
            except Exception:
                pass

