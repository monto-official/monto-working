"""
Monto AI — GPU Whisper STT Server
Runs on the GPU machine. Serves faster-whisper via HTTP.

Port  : 5001 (default)
Auth  : Bearer token from GPU_SERVER_API_KEY
Model : configured by WHISPER_MODEL env var

Usage:
    python whisper_server.py

Endpoints:
    POST /v1/audio/transcriptions   — OpenAI-compatible transcription
    GET  /health                    — status + model info
"""
import os
import io
import logging
import tempfile
import threading
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
API_KEY      = os.getenv("GPU_SERVER_API_KEY", "monto-secret-2024")
MODEL_SIZE   = os.getenv("WHISPER_MODEL",      "large-v3")
DEVICE       = os.getenv("WHISPER_DEVICE",     "cuda")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE",    "float16")
PORT         = int(os.getenv("WHISPER_PORT",   "5001"))

# ── Auth ──────────────────────────────────────────────────────────────────────
security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return credentials.credentials

# ── Model ──────────────────────────────────────────────────────────────────────
_model      = None
_model_lock = threading.Lock()

def get_model():
    global _model
    with _model_lock:
        if _model is None:
            raise HTTPException(status_code=503, detail="Model not loaded yet — try again shortly")
        return _model


def load_model():
    global _model
    logger.info(f"Loading faster-whisper [{MODEL_SIZE}] on {DEVICE}...")
    from faster_whisper import WhisperModel
    _model = WhisperModel(
        MODEL_SIZE,
        device=DEVICE,
        compute_type=COMPUTE_TYPE,
        cpu_threads=4,
        num_workers=2,
    )
    logger.info(f"✅ Whisper model [{MODEL_SIZE}] loaded on {DEVICE}")

# ── App ────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model in a thread so FastAPI starts fast
    t = threading.Thread(target=load_model, daemon=True)
    t.start()
    yield
    logger.info("Whisper server shutting down")

app = FastAPI(title="Monto Whisper STT", version="1.0.0", lifespan=lifespan)

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    model_ready = _model is not None
    return {
        "status":     "ok" if model_ready else "loading",
        "model":      MODEL_SIZE,
        "device":     DEVICE,
        "compute":    COMPUTE_TYPE,
        "ready":      model_ready,
    }


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file:  UploadFile = File(...),
    token: str        = Depends(verify_token),
):
    model = get_model()

    audio_bytes = await file.read()
    if not audio_bytes or len(audio_bytes) < 1000:
        return {"text": "", "language": "unknown", "duration": 0.0}

    # Write to temp file — faster-whisper needs a path or numpy array
    suffix = "." + (file.filename or "audio.wav").rsplit(".", 1)[-1].lower()
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        os.write(fd, audio_bytes)
        os.close(fd)

        segments, info = model.transcribe(
            tmp_path,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
            language=os.getenv("WHISPER_LANGUAGE") or None,
        )

        text = " ".join(seg.text.strip() for seg in segments).strip()
        logger.info(f"Transcribed [{info.language}] ({info.duration:.1f}s): '{text[:80]}'")

        return {
            "text":     text,
            "language": info.language,
            "duration": round(info.duration, 2),
        }
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
