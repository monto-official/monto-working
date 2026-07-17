"""
WebRTC Signaling — /ws/call
Simple room-based WebSocket relay.
  - child connects as role="child"
  - parent connects as role="parent"
  - All messages are relayed between the two peers in the same room
  - Supports: offer, answer, ice-candidate, ring, accept, reject, hangup
"""
import json
import logging
from typing import Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()

# room_id -> {"child": ws, "parent": ws}
rooms: Dict[str, Dict[str, Optional[WebSocket]]] = {}

ROOM_ID = "monto-room"   # single-room for now (one child + one parent)


@router.websocket("/ws/call")
async def call_signaling(websocket: WebSocket, role: str = "child"):
    await websocket.accept()

    if ROOM_ID not in rooms:
        rooms[ROOM_ID] = {"child": None, "parent": None}

    room = rooms[ROOM_ID]

    if role not in ("child", "parent"):
        await websocket.close(code=4000, reason="invalid role")
        return

    room[role] = websocket
    peer_role = "parent" if role == "child" else "child"
    logger.info(f"[Signaling] {role} joined room {ROOM_ID}")

    # Notify peer that this side is online
    peer = room.get(peer_role)
    if peer:
        try:
            await peer.send_text(json.dumps({"type": "peer-online", "role": role}))
        except Exception:
            pass

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            logger.debug(f"[Signaling] {role} -> {peer_role}: {msg.get('type')}")

            # Relay message to the other peer
            peer = room.get(peer_role)
            if peer:
                try:
                    await peer.send_text(json.dumps({**msg, "from": role}))
                except Exception:
                    logger.warning(f"[Signaling] failed to relay to {peer_role}")
            else:
                # Peer not connected — let caller know
                if msg.get("type") == "ring":
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "Parent app is not connected. Open the parent app first."
                    }))

    except WebSocketDisconnect:
        room[role] = None
        logger.info(f"[Signaling] {role} left room {ROOM_ID}")

        # Notify peer about disconnect
        peer = room.get(peer_role)
        if peer:
            try:
                await peer.send_text(json.dumps({"type": "peer-offline", "role": role}))
            except Exception:
                pass
