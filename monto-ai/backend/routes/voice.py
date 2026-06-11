"""
Voice Routes
POST /voice/query   — receives audio, returns AI structured response (JSON)
POST /voice/process — used by Raspberry Pi: returns JSON + triggers TTS internally
"""
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Header
from fastapi.responses import Response
from models.schemas import VoiceQueryResponse
from services.stt_service import STTService
from services.llm_service import LLMService
from services.tts_service import TTSService
from services.emotion_service import resolve_animation
from services.memory_service import memory
from services.content_filter import check_content, sanitize_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

DEFAULT_SESSION = "pi-default"


def get_stt_service() -> STTService:
    from main import stt_service
    return stt_service


def get_llm_service() -> LLMService:
    from main import llm_service
    return llm_service


def get_tts_service() -> TTSService:
    from main import tts_service
    return tts_service


@router.post("/query", response_model=VoiceQueryResponse)
async def voice_query(
    audio:      UploadFile = File(...),
    session_id: str        = Header(default="web-default", alias="X-Session-Id"),
    stt:        STTService  = Depends(get_stt_service),
    llm:        LLMService  = Depends(get_llm_service),
):
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")

    audio_bytes = await audio.read()
    if not audio_bytes or len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio file too small")

    logger.info(f"[{session_id}] Audio: {len(audio_bytes):,} bytes | type: {audio.content_type} | file: {audio.filename}")

    try:
        transcript = await stt.transcribe(audio_bytes, audio.filename or "audio.webm")
    except Exception as e:
        logger.error(f"STT failed: {e}")
        raise HTTPException(status_code=502, detail=f"Speech recognition failed: {str(e)}")

    if not transcript.strip():
        # Return a friendly response instead of an error — better UX for children
        from models.schemas import LLMResponse
        return VoiceQueryResponse(
            transcript="",
            intent="UNKNOWN",
            emotion="neutral",
            animation="blink",
            response="Hmm, I didn't quite catch that! Could you say it again a little louder? 😊",
            confidence=0.0,
        )

    # Layer 1: Filter child's input before sending to LLM
    filter_result = check_content(transcript)
    if not filter_result.is_safe:
        logger.info(f"[{session_id}] Content blocked [{filter_result.category}]")
        memory.add_turn(session_id, transcript, filter_result.redirect_response)
        return VoiceQueryResponse(
            transcript=transcript,
            intent="UNKNOWN",
            emotion=filter_result.emotion,
            animation=resolve_animation(filter_result.emotion, filter_result.animation),
            response=filter_result.redirect_response,
            confidence=1.0,
        )

    history      = memory.get_history(session_id)
    facts_prompt = memory.get_facts_prompt(session_id)

    try:
        llm_result = await llm.get_response(transcript, history, facts_prompt)
    except Exception as e:
        logger.error(f"LLM failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI response failed: {str(e)}")

    # Layer 2: Filter LLM output too
    llm_result.response = sanitize_response(llm_result.response)
    memory.add_turn(session_id, transcript, llm_result.response)
    animation = resolve_animation(llm_result.emotion.value, llm_result.animation.value)

    return VoiceQueryResponse(
        transcript=transcript,
        intent=llm_result.intent.value,
        emotion=llm_result.emotion.value,
        animation=animation,
        response=llm_result.response,
        confidence=llm_result.confidence,
    )


@router.post("/process")
async def voice_process(
    audio:      UploadFile = File(...),
    session_id: str        = Header(default=DEFAULT_SESSION, alias="X-Session-Id"),
    stt:        STTService  = Depends(get_stt_service),
    llm:        LLMService  = Depends(get_llm_service),
    tts:        TTSService  = Depends(get_tts_service),
):
    """Used by Raspberry Pi — STT + LLM + memory, returns JSON for face + TTS."""
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")

    audio_bytes = await audio.read()
    if not audio_bytes or len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio too short or empty")

    logger.info(f"[Pi/{session_id}] Audio: {len(audio_bytes):,} bytes | type: {audio.content_type}")

    try:
        transcript = await stt.transcribe(audio_bytes, audio.filename or "audio.wav")
    except Exception as e:
        logger.error(f"[Pi] STT failed: {e}")
        raise HTTPException(status_code=502, detail=f"STT failed: {str(e)}")

    if not transcript.strip():
        return {
            "transcript": "",
            "intent":     "UNKNOWN",
            "emotion":    "neutral",
            "animation":  "blink",
            "response":   "Hmm, I didn't catch that! Could you say it again? 😊",
            "confidence": 0.0,
        }

    # Layer 1: Filter child's input
    filter_result = check_content(transcript)
    if not filter_result.is_safe:
        logger.info(f"[Pi/{session_id}] Content blocked [{filter_result.category}]")
        memory.add_turn(session_id, transcript, filter_result.redirect_response)
        return {
            "transcript": transcript,
            "intent":     "UNKNOWN",
            "emotion":    filter_result.emotion,
            "animation":  resolve_animation(filter_result.emotion, filter_result.animation),
            "response":   filter_result.redirect_response,
            "confidence": 1.0,
        }

    history      = memory.get_history(session_id)
    facts_prompt = memory.get_facts_prompt(session_id)

    try:
        llm_result = await llm.get_response(transcript, history, facts_prompt)
    except Exception as e:
        logger.error(f"[Pi] LLM failed: {e}")
        raise HTTPException(status_code=502, detail=f"LLM failed: {str(e)}")

    # Layer 2: Filter LLM output
    llm_result.response = sanitize_response(llm_result.response)
    memory.add_turn(session_id, transcript, llm_result.response)
    animation = resolve_animation(llm_result.emotion.value, llm_result.animation.value)

    logger.info(f"[Pi/{session_id}] [{llm_result.emotion.value}] {llm_result.response[:80]}")

    return {
        "transcript": transcript,
        "intent":     llm_result.intent.value,
        "emotion":    llm_result.emotion.value,
        "animation":  animation,
        "response":   llm_result.response,
        "confidence": llm_result.confidence,
    }


@router.delete("/memory/{session_id}")
async def clear_memory(session_id: str):
    """Clear conversation memory for a session (fresh start)."""
    memory.clear(session_id)
    return {"status": "cleared", "session_id": session_id}


@router.get("/memory/{session_id}")
async def get_memory_summary(session_id: str):
    """Get memory stats and known facts for a session."""
    return memory.get_session_summary(session_id)


@router.get("/memory")
async def list_sessions():
    """List all sessions that have stored memory."""
    sessions = memory.get_all_sessions()
    return {
        "sessions": sessions,
        "total": len(sessions),
    }
