"""
TTS Route
POST /tts/speak — text + emotion → audio bytes (WAV in local mode, MP3 in cloud)
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from services.tts_service import TTSService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text:     str
    voice:    str = "monto"    # monto | male | female | piper-voice-name
    emotion:  str = "neutral"  # drives voice expressiveness / speed
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
    Convert text → audio.
    Returns WAV (local Piper) or MP3 (ElevenLabs cloud) depending on mode.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if len(req.text) > 1000:
        raise HTTPException(status_code=400, detail="Text too long (max 1000 chars)")

    if not tts or not tts.enabled:
        raise HTTPException(status_code=503, detail="TTS service not available")

    try:
        audio_bytes = await tts.synthesize(
            text=req.text,
            voice=req.voice,
            emotion=req.emotion,
            language=req.language,
        )

        # Return correct MIME type based on which backend is active
        mime = getattr(tts, "audio_format", "audio/mpeg")
        ext  = "wav" if mime == "audio/wav" else "mp3"

        return Response(
            content=audio_bytes,
            media_type=mime,
            headers={
                "Content-Disposition": f"inline; filename=monto_speech.{ext}",
                "Cache-Control": "no-cache",
            },
        )
    except Exception as e:
        logger.error(f"TTS route error: {e}")
        raise HTTPException(status_code=502, detail=f"TTS failed: {str(e)}")
