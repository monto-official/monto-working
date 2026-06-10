"""
MONTO AI — FastAPI Backend
Child-safe voice AI companion backend service.
"""
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models.schemas import HealthResponse
from routes.voice import router as voice_router
from routes.tts import router as tts_router
from services.stt_service import STTService
from services.groq_service import GroqService
from services.tts_service import TTSService

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Global service instances
stt_service: STTService = None
groq_service: GroqService = None
tts_service: TTSService = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup."""
    global stt_service, groq_service, tts_service

    stt_key = os.getenv("GROQ_API_KEY")
    llm_key = os.getenv("GROQ_API_KEY_LLM") or stt_key
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")

    if not stt_key or stt_key == "your_groq_api_key_here":
        logger.error("❌ GROQ_API_KEY is not set! Add it to .env")
        raise RuntimeError("GROQ_API_KEY is required.")

    stt_service = STTService(api_key=stt_key)
    groq_service = GroqService(api_key=llm_key)

    if elevenlabs_key and elevenlabs_key != "your_elevenlabs_api_key_here":
        tts_service = TTSService(api_key=elevenlabs_key)
        logger.info("✅ TTS Service (ElevenLabs) ready")
    else:
        logger.warning("⚠️  ELEVENLABS_API_KEY not set — TTS will fall back to browser")

    logger.info("✅ MONTO AI Backend started successfully")
    logger.info("✅ STT Service (Whisper Large V3) ready")
    logger.info("✅ LLM Service (Qwen3-32B) ready")

    yield

    logger.info("🛑 MONTO AI Backend shutting down")


# Create FastAPI app
app = FastAPI(
    title="MONTO AI API",
    description="Child-safe voice AI companion backend",
    version="1.0.0",
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

# Register routes
app.include_router(voice_router)
app.include_router(tts_router)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    tts_status = "elevenlabs" if tts_service and tts_service.enabled else "browser"
    return HealthResponse(status="ok", version="1.0.0")


@app.get("/")
async def root():
    return {"message": "MONTO AI Backend is running 🤖", "docs": "/docs"}
