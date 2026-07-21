"""
Monto AI — GPU Piper TTS Server
Runs on the GPU machine. Serves Piper TTS via HTTP.

Port  : 5002 (default)
Auth  : Bearer token from GPU_SERVER_API_KEY
Output: WAV audio bytes

Usage:
    python piper_server.py

Endpoints:
    POST /v1/tts/synthesize   — text + voice + emotion → WAV bytes
    GET  /voices              — list downloaded voice models
    GET  /health              — status
"""
import io
import os
import json
import logging
import subprocess
import tempfile
import threading
from pathlib import Path

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
API_KEY       = os.getenv("GPU_SERVER_API_KEY",   "monto-secret-2024")
DEFAULT_VOICE = os.getenv("PIPER_DEFAULT_VOICE",  "en_US-amy-medium")
VOICES_DIR    = Path(os.getenv("PIPER_VOICES_DIR", "./voices"))
PORT          = int(os.getenv("PIPER_PORT",        "5002"))
PIPER_BIN     = os.getenv("PIPER_BIN",             "piper")

# Emotion → Piper speed tuning (length_scale: higher = slower)
EMOTION_SPEED = {
    "happy":     0.90,
    "excited":   0.82,
    "sad":       1.20,
    "thinking":  1.10,
    "surprised": 0.85,
    "neutral":   1.00,
    "talking":   1.00,
}

# ── Auth ──────────────────────────────────────────────────────────────────────
security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return credentials.credentials

# ── Schema ────────────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text:    str
    voice:   str = DEFAULT_VOICE
    emotion: str = "neutral"

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Monto Piper TTS", version="1.0.0")

# ── Helpers ───────────────────────────────────────────────────────────────────

def _find_model(voice: str) -> Path:
    """Locate <voice>.onnx in VOICES_DIR. Tries exact match then default."""
    VOICES_DIR.mkdir(parents=True, exist_ok=True)

    # Try exact voice name
    candidate = VOICES_DIR / f"{voice}.onnx"
    if candidate.exists():
        return candidate

    # Try default voice
    default = VOICES_DIR / f"{DEFAULT_VOICE}.onnx"
    if default.exists():
        return default

    # Any available voice
    models = list(VOICES_DIR.glob("*.onnx"))
    if models:
        logger.warning(f"Voice '{voice}' not found — using {models[0].name}")
        return models[0]

    raise FileNotFoundError(
        f"No Piper voice models found in {VOICES_DIR}. "
        f"Download one from https://github.com/rhasspy/piper/releases "
        f"and place the .onnx file in {VOICES_DIR}/"
    )


def _synthesize(text: str, voice: str, emotion: str) -> bytes:
    """Run piper subprocess and return WAV bytes."""
    model_path = _find_model(voice)
    length_scale = EMOTION_SPEED.get(emotion, 1.0)

    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)

    try:
        result = subprocess.run(
            [
                PIPER_BIN,
                "--model",        str(model_path),
                "--output_file",  wav_path,
                "--length_scale", str(length_scale),
            ],
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"Piper exited {result.returncode}: {result.stderr.decode()[:200]}"
            )

        with open(wav_path, "rb") as f:
            return f.read()
    finally:
        try:
            os.unlink(wav_path)
        except OSError:
            pass

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    models = [p.stem for p in VOICES_DIR.glob("*.onnx")] if VOICES_DIR.exists() else []
    # Check piper binary exists
    try:
        result = subprocess.run([PIPER_BIN, "--version"], capture_output=True, timeout=5)
        piper_ok = result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        piper_ok = False

    return {
        "status":         "ok" if piper_ok else "piper_not_found",
        "piper_binary":   PIPER_BIN,
        "piper_ok":       piper_ok,
        "voices_dir":     str(VOICES_DIR),
        "available_voices": models,
        "default_voice":  DEFAULT_VOICE,
    }


@app.get("/voices")
async def list_voices(token: str = Depends(verify_token)):
    if not VOICES_DIR.exists():
        return {"voices": []}
    voices = [
        {"name": p.stem, "path": str(p), "size_mb": round(p.stat().st_size / 1_048_576, 1)}
        for p in sorted(VOICES_DIR.glob("*.onnx"))
    ]
    return {"voices": voices}


@app.post("/v1/tts/synthesize")
async def synthesize(
    req:   TTSRequest,
    token: str = Depends(verify_token),
):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    logger.info(f"TTS [{req.emotion}] voice={req.voice}: '{req.text[:60]}'")

    try:
        wav_bytes = _synthesize(req.text, req.voice, req.emotion)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    logger.info(f"Piper WAV: {len(wav_bytes):,} bytes")
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": "inline; filename=speech.wav"},
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
