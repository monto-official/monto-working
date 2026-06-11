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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

from models.schemas import HealthResponse
from routes.voice  import router as voice_router
from routes.tts    import router as tts_router
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
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")

    mode = "LOCAL GPU" if USE_LOCAL else "GROQ cloud (testing)"
    logger.info(f"🚀 Starting Monto AI backend — mode: {mode}")

    # Validate keys for cloud mode
    if not USE_LOCAL:
        if not groq_key or groq_key == "your_groq_api_key_here":
            raise RuntimeError(
                "GROQ_API_KEY is required when USE_LOCAL_GPU=false. "
                "Set it in backend/.env or switch to USE_LOCAL_GPU=true"
            )

    # Initialise services
    stt_service = STTService(api_key=groq_key)
    llm_service = LLMService(api_key=groq_key)
    tts_service = TTSService(api_key=elevenlabs_key)

    logger.info(f"✅ STT  : {'GPU Whisper' if USE_LOCAL else 'Groq Whisper'}")
    logger.info(f"✅ LLM  : {'GPU Ollama qwen3:8b' if USE_LOCAL else 'Groq qwen3-32b'}")
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
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(voice_router)
app.include_router(tts_router)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", version="2.0.0")


@app.get("/")
async def root():
    mode = "local GPU" if USE_LOCAL else "Groq cloud"
    return {
        "message": "Monto AI Backend is running 🤖",
        "mode":    mode,
        "docs":    "/docs",
    }
