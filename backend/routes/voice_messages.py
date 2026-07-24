"""
Voice Messages Route -- /voice-messages
Short recorded voice notes sent either direction between a paired parent and
child device. Audio is stored inline as base64 in Supabase (clips are short --
the recorder auto-stops at 30s -- so this avoids a separate blob storage
bucket). Delivery is pushed instantly over the existing
`${deviceId}:control` Firebase channel by the caller; this route is the
durable record both apps re-list from on load.
"""
import base64
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice-messages", tags=["voice-messages"])

MAX_AUDIO_BYTES = 8 * 1024 * 1024  # 8 MB -- generous ceiling for a short voice note


class VoiceMessageOut(BaseModel):
    id: str
    sender_role: str
    duration_ms: Optional[int] = None
    mime_type: str
    created_at: str
    listened_at: Optional[str] = None


@router.get("/{device_id}", response_model=list[VoiceMessageOut])
async def list_voice_messages(device_id: str, after: Optional[str] = None):
    """List every voice message (either direction) for this child device,
    metadata only -- no audio bytes, to keep the list payload light."""
    db = get_supabase()
    query = (
        db.table("voice_messages")
        .select("id, sender_role, duration_ms, mime_type, created_at, listened_at")
        .eq("child_device_id", device_id)
    )
    if after:
        query = query.gt("created_at", after)
    res = query.order("created_at", desc=True).execute()
    return res.data or []


@router.post("/{device_id}", response_model=VoiceMessageOut)
async def create_voice_message(
    device_id: str,
    audio: UploadFile = File(...),
    sender_role: str = Form(...),
    duration_ms: Optional[int] = Form(None),
):
    """Record a new voice note. `sender_role` is who recorded it -- the
    child kiosk sends "child", the parent app sends "parent"."""
    if sender_role not in ("parent", "child"):
        raise HTTPException(status_code=400, detail="sender_role must be 'parent' or 'child'")
    if duration_ms is not None and not 0 <= duration_ms <= 30_000:
        raise HTTPException(status_code=400, detail="duration_ms must be between 0 and 30000")

    audio_bytes = await audio.read()
    if not audio_bytes or len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio file too small")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="Audio file too large")

    mime_type = (audio.content_type or "audio/webm").lower().strip()
    base_mime_type = mime_type.split(";", 1)[0].strip()
    if base_mime_type not in {"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"}:
        raise HTTPException(status_code=415, detail="Unsupported audio format")

    db = get_supabase()

    # voice_messages.child_device_id has a foreign-key constraint on
    # devices(device_id). Normally that row is created by POST /pairing/code,
    # but a voice note can be the very first thing a freshly-launched child
    # app sends -- self-register here too (same upsert pairing.py uses) so
    # this never 500s on an otherwise-valid request.
    db.table("devices").upsert({
        "device_id": device_id,
        "role": "child",
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="device_id").execute()

    res = (
        db.table("voice_messages")
        .insert({
            "child_device_id": device_id,
            "sender_role": sender_role,
            "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
            "mime_type": mime_type,
            "duration_ms": duration_ms,
        })
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save voice message")

    row = res.data[0]
    return VoiceMessageOut(
        id=row["id"],
        sender_role=row["sender_role"],
        duration_ms=row.get("duration_ms"),
        mime_type=row["mime_type"],
        created_at=row["created_at"],
        listened_at=row.get("listened_at"),
    )


@router.get("/{device_id}/{message_id}/audio")
async def get_voice_message_audio(device_id: str, message_id: str, request: Request):
    """Download the raw audio for one voice message. Best-effort marks it
    as listened on first fetch (a deliberate simplification over a separate
    ack endpoint)."""
    db = get_supabase()
    res = (
        db.table("voice_messages")
        .select("audio_base64, mime_type, listened_at")
        .eq("child_device_id", device_id)
        .eq("id", message_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Voice message not found")

    row = res.data[0]
    if not row.get("listened_at"):
        try:
            db.table("voice_messages").update({
                "listened_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", message_id).execute()
        except Exception as exc:
            logger.warning(f"[VoiceMessages] failed to mark {message_id} listened (non-fatal): {exc}")

    try:
        audio_bytes = base64.b64decode(row["audio_base64"], validate=True)
    except Exception as exc:
        logger.error(f"[VoiceMessages] corrupt audio payload for {message_id}: {exc}")
        raise HTTPException(status_code=500, detail="Voice message audio is unavailable") from exc

    headers = {
        "Cache-Control": "private, no-cache",
        "X-Content-Type-Options": "nosniff",
        "Accept-Ranges": "bytes",
    }
    range_header = request.headers.get("range")
    if range_header and range_header.startswith("bytes="):
        try:
            range_value = range_header[6:].split(",", 1)[0]
            start_text, end_text = range_value.split("-", 1)
            if start_text:
                start = int(start_text)
                end = int(end_text) if end_text else len(audio_bytes) - 1
            else:
                suffix_length = int(end_text)
                start = max(0, len(audio_bytes) - suffix_length)
                end = len(audio_bytes) - 1
            if start < 0 or end < start or start >= len(audio_bytes):
                raise ValueError
            end = min(end, len(audio_bytes) - 1)
        except (ValueError, TypeError):
            return Response(status_code=416, headers={"Content-Range": f"bytes */{len(audio_bytes)}"})
        chunk = audio_bytes[start:end + 1]
        headers["Content-Range"] = f"bytes {start}-{end}/{len(audio_bytes)}"
        headers["Content-Length"] = str(len(chunk))
        return Response(content=chunk, status_code=206, media_type=row["mime_type"], headers=headers)

    headers["Content-Length"] = str(len(audio_bytes))
    return Response(content=audio_bytes, media_type=row["mime_type"], headers=headers)
