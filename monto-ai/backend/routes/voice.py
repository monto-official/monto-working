"""
Voice Routes
POST /voice/query — receives audio, returns AI structured response
"""
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from models.schemas import VoiceQueryResponse
from services.stt_service import STTService
from services.groq_service import GroqService
from services.emotion_service import resolve_animation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])


def get_stt_service() -> STTService:
    from main import stt_service
    return stt_service


def get_groq_service() -> GroqService:
    from main import groq_service
    return groq_service


@router.post("/query", response_model=VoiceQueryResponse)
async def voice_query(
    audio: UploadFile = File(...),
    stt: STTService = Depends(get_stt_service),
    groq: GroqService = Depends(get_groq_service),
):
    """
    Accepts an audio file, transcribes it, sends to LLM, returns structured JSON.
    """
    # Validate file
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio file too small — please speak longer")

    logger.info(f"Received audio: {audio.filename}, size: {len(audio_bytes)} bytes")

    # Step 1: Speech to Text
    try:
        transcript = await stt.transcribe(audio_bytes, audio.filename or "audio.webm")
    except Exception as e:
        logger.error(f"STT failed: {e}")
        raise HTTPException(status_code=502, detail=f"Speech recognition failed: {str(e)}")

    if not transcript.strip():
        raise HTTPException(status_code=422, detail="Could not understand the audio. Please speak clearly.")

    # Step 2: LLM Response
    try:
        llm_result = await groq.get_response(transcript)
    except Exception as e:
        logger.error(f"LLM failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI response failed: {str(e)}")

    # Step 3: Resolve animation
    animation = resolve_animation(llm_result.emotion.value, llm_result.animation.value)

    return VoiceQueryResponse(
        transcript=transcript,
        intent=llm_result.intent.value,
        emotion=llm_result.emotion.value,
        animation=animation,
        response=llm_result.response,
        confidence=llm_result.confidence,
    )
