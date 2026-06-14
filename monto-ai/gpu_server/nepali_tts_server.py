"""
Monto AI — GPU Nepali TTS Server
Runs on the GPU machine. Serves Edge TTS (Microsoft Neural) for Nepali.

Port  : 5003 (default)
Auth  : Bearer token from GPU_SERVER_API_KEY
Output: MP3 audio bytes

Usage:
    python nepali_tts_server.py

Endpoints:
    POST /v1/tts/nepali   — text → MP3 bytes
    GET  /health          — status + available voices
"""
import io
import os
import logging

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
API_KEY       = os.getenv("GPU_SERVER_API_KEY", "monto-secret-2024")
NEPALI_VOICE  = os.getenv("NEPALI_VOICE",       "ne-NP-HemkalaNeural")
PORT          = int(os.getenv("NEPALI_TTS_PORT", "5003"))

# ── Auth ──────────────────────────────────────────────────────────────────────
security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return credentials.credentials

# ── Schema ────────────────────────────────────────────────────────────────────

class NepaliTTSRequest(BaseModel):
    text:  str
    voice: str = NEPALI_VOICE   # can override per-request

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Monto Nepali TTS", version="1.0.0")

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _edge_tts(text: str, voice: str) -> bytes:
    """Synthesize Nepali speech via edge-tts library."""
    import edge_tts
    buf = io.BytesIO()
    communicate = edge_tts.Communicate(text, voice)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    buf.seek(0)
    data = buf.read()
    if not data:
        raise RuntimeError("Edge TTS returned empty audio")
    return data

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    try:
        import edge_tts
        edge_ok = True
    except ImportError:
        edge_ok = False

    return {
        "status":        "ok" if edge_ok else "edge_tts_missing",
        "edge_tts":      edge_ok,
        "default_voice": NEPALI_VOICE,
        "voices": [
            "ne-NP-HemkalaNeural",  # Female — best for kids
            "ne-NP-SagarNeural",    # Male
        ],
    }


@app.post("/v1/tts/nepali")
async def nepali_tts(
    req:   NepaliTTSRequest,
    token: str = Depends(verify_token),
):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    logger.info(f"Nepali TTS [{req.voice}]: '{req.text[:60]}'")

    try:
        mp3_bytes = await _edge_tts(req.text, req.voice)
        logger.info(f"Nepali TTS: {len(mp3_bytes):,} bytes")
        return Response(
            content=mp3_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=nepali_speech.mp3"},
        )
    except Exception as e:
        logger.error(f"Nepali TTS error: {e}")
        raise HTTPException(status_code=502, detail=f"Nepali TTS failed: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
