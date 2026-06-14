"""
TTS Route
POST /tts/speak — text + emotion → audio bytes
Auto-detects Nepali from text content — no need to pass language explicitly.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from services.tts_service import TTSService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tts", tags=["tts"])


def _is_nepali(text: str) -> bool:
    return any('\u0900' <= ch <= '\u097F' for ch in text)


class TTSRequest(BaseModel):
    text:     str
    voice:    str = "monto"
    emotion:  str = "neutral"
    language: str = "auto"   # "auto" = detect from text, "nepali", "english"


def get_tts_service() -> TTSService:
    from main import tts_service
    return tts_service


@router.post("/speak")
async def speak(
    req: TTSRequest,
    tts: TTSService = Depends(get_tts_service),
):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if len(req.text) > 1000:
        raise HTTPException(status_code=400, detail="Text too long (max 1000 chars)")

    if not tts or not tts.enabled:
        raise HTTPException(status_code=503, detail="TTS service not available")

    # Auto-detect language if not explicitly set
    if req.language == "auto":
        language = "nepali" if _is_nepali(req.text) else "english"
    else:
        language = req.language

    logger.info(f"TTS [{language}/{req.emotion}]: '{req.text[:60]}'")

    try:
        audio_bytes = await tts.synthesize(
            text=req.text,
            voice=req.voice,
            emotion=req.emotion,
            language=language,
        )

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
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=502, detail=f"TTS failed: {str(e)}")
