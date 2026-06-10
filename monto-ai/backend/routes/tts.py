"""
TTS Route
POST /tts/speak — receives text + voice settings, returns MP3 audio
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from services.tts_service import TTSService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str
    voice: str = "female"   # "male" | "female"
    language: str = "english"


def get_tts_service() -> TTSService:
    from main import tts_service
    return tts_service


@router.post("/speak")
async def speak(
    req: TTSRequest,
    tts: TTSService = Depends(get_tts_service),
):
    """
    Convert text to speech using ElevenLabs.
    Returns raw MP3 audio with Content-Type: audio/mpeg.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if len(req.text) > 1000:
        raise HTTPException(status_code=400, detail="Text too long (max 1000 chars)")

    if not tts or not tts.enabled:
        raise HTTPException(status_code=503, detail="TTS service unavailable")

    try:
        audio_bytes = await tts.synthesize(
            text=req.text,
            voice=req.voice,
            language=req.language,
        )
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=monto_speech.mp3",
                "Cache-Control": "no-cache",
            },
        )
    except Exception as e:
        logger.error(f"TTS route error: {e}")
        raise HTTPException(status_code=502, detail=f"TTS failed: {str(e)}")
