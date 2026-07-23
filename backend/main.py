"""
Monto AI — FastAPI Backend
Child-safe voice AI companion.

Modes (set in .env):
  USE_LOCAL_GPU=false  → uses Groq (STT+LLM) + ElevenLabs (TTS)  ← testing
  USE_LOCAL_GPU=true   → uses GPU server: Whisper + Ollama + Piper ← production
"""
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

from models.schemas import HealthResponse
from routes.voice      import router as voice_router
from routes.tts        import router as tts_router
from routes.call       import router as call_router
from routes.signaling  import router as signaling_router
from routes.settings   import router as settings_router
from routes.moderation import router as moderation_router
from routes.controls   import router as controls_router
from routes.pairing    import router as pairing_router
from routes.auth       import router as auth_router
from routes.reminders  import router as reminders_router
from routes.bedtime    import router as bedtime_router
from routes.usage      import router as usage_router
from routes.call_signal import router as call_signal_router
from services.stt_service import STTService
from services.llm_service import LLMService
from services.tts_service import TTSService

# Global service singletons — accessed by route handlers
stt_service:  STTService  = None
llm_service:  LLMService  = None
tts_service:  TTSService  = None

USE_LOCAL = os.getenv("USE_LOCAL_GPU", "false").lower() == "true"


@asynccontextmanager
async def lifespan(app: FastAPI):
    global stt_service, llm_service, tts_service

    groq_key       = os.getenv("GROQ_API_KEY", "")
    groq_keys      = os.getenv("GROQ_API_KEYS", "")
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "") or os.getenv("ELEVENLABS_API_KEYS", "").split(",")[0].strip() or os.getenv("ELEVENLABS_API_KEY_1", "")

    mode = "LOCAL GPU" if USE_LOCAL else "GROQ cloud (testing)"
    logger.info(f"🚀 Starting Monto AI backend — mode: {mode}")

    # Validate keys for cloud mode
    if not USE_LOCAL:
        if not (groq_key or groq_keys):
            raise RuntimeError(
                "GROQ_API_KEY or GROQ_API_KEYS is required when USE_LOCAL_GPU=false. "
                "Set it in backend/.env or switch to USE_LOCAL_GPU=true"
            )

    # Initialise services
    stt_service = STTService(api_key=groq_key)
    llm_service = LLMService(api_key=groq_key)
    tts_service = TTSService(api_key=elevenlabs_key)

    logger.info(f"✅ STT  : {'GPU Whisper' if USE_LOCAL else 'Groq Whisper'}")
    logger.info("LLM  : %s", "GPU Ollama" if USE_LOCAL else "Groq smart routing (GPT-OSS + Llama 3.3)")
    logger.info(f"✅ TTS  : {'GPU Piper' if USE_LOCAL else 'ElevenLabs' if tts_service.enabled else 'disabled'}")
    logger.info("✅ Monto AI backend ready")

    yield

    logger.info("🛑 Monto AI backend shutting down")


app = FastAPI(
    title="Monto AI API",
    description="Child-safe voice AI companion",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://localhost:3002",
).split(",")
production_origins = [
    "https://frontend-deploy-alpha-woad.vercel.app",  # child app
    "https://parent-app-plum.vercel.app",             # parent app
    "http://localhost",   # packaged Capacitor Android apps (androidScheme: "http")
]
for origin in production_origins:
    if origin not in allowed_origins:
        allowed_origins.append(origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    # Also allow: (1) any device on the local network (192.168.x.x, 10.x.x.x,
    # 172.16-31.x.x) or Tailscale (100.64.0.0/10) hitting the child/parent/
    # admin dev ports, so the pairing QR's embedded LAN/Tailscale IP works
    # from a phone/tablet on the same wifi or tailnet; (2) the Cloudflare
    # quick-tunnel origins the child/parent/admin apps are exposed through
    # for cross-network access — those get a new random *.trycloudflare.com
    # subdomain each time the tunnel restarts, so the whole domain is
    # allowed rather than one fixed subdomain.
    allow_origin_regex=r"^https?://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}):(3000|3001|3002)$|^https://[a-zA-Z0-9-]+\.trycloudflare\.com$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(voice_router)
app.include_router(tts_router)
app.include_router(call_router)
app.include_router(signaling_router)
app.include_router(settings_router)
app.include_router(moderation_router)
app.include_router(controls_router)
app.include_router(pairing_router)
app.include_router(auth_router)
app.include_router(reminders_router)
app.include_router(bedtime_router)
app.include_router(usage_router)
app.include_router(call_signal_router)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", version="2.0.0")


@app.post("/debug/log")
async def debug_log(payload: dict):
    """Temporary diagnostic sink — logs whatever the client posts."""
    logger.info(f"[CLIENT DEBUG] {payload}")
    return {"ok": True}


@app.get("/")
async def root():
    mode = "local GPU" if USE_LOCAL else "Groq cloud"
    return {
        "message": "Monto AI Backend is running 🤖",
        "mode":    mode,
        "docs":    "/docs",
    }
