"""
Voice Routes
POST /voice/query   — receives audio, returns AI structured response (JSON)
POST /voice/process — used by Raspberry Pi: returns JSON for face + TTS
"""
import asyncio
import logging
import re
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Header, BackgroundTasks
from fastapi.responses import Response
from models.schemas import VoiceQueryResponse
from services.stt_service import STTService
from services.llm_service import LLMService
from services.tts_service import TTSService
from services.emotion_service import resolve_animation
from services.memory_service import memory
from services.content_filter import check_content, sanitize_response
from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

DEFAULT_SESSION = "pi-default"


def _record_usage_event(session_id: str):
    """Best-effort usage tracking — never let a Supabase hiccup (or Supabase
    being unconfigured) break the voice pipeline."""
    try:
        db = get_supabase()
    except RuntimeError:
        return
    try:
        db.table("usage_events").insert({"child_device_id": session_id}).execute()
    except Exception as exc:
        logger.warning(f"[Usage] usage_events insert failed (non-fatal): {exc}")

# ── Language detection ────────────────────────────────────────────────────────

def detect_language(text: str) -> str:
    """Detect Unicode or common Romanized Nepali voice transcripts."""
    if any('\u0900' <= ch <= '\u097F' for ch in text):
        return "nepali"
    words = set(re.findall(r"[a-z]+", text.lower()))
    nepali_words = {
        "ma", "malai", "mero", "hamro", "hami", "timi", "tapai", "timro",
        "ke", "kina", "kasari", "kasto", "kata", "kahile", "ko", "ho", "hoina",
        "cha", "chha", "chu", "chhan", "garnu", "gara", "bhanana", "bhannu",
        "ramro", "dhanyabad", "namaste", "suna", "aaja", "bholi", "hijo",
        "chau", "chhau", "kasto", "kosto", "timilai", "malai",
    }
    # Require two markers to avoid classifying isolated English words such as
    # "ma" or "go" as Nepali.
    exact_hits = len(words & nepali_words)
    joined = " ".join(words)
    joined_hits = sum(marker in joined for marker in ("timikasto", "timikosto", "timi", "malai", "kasari", "chhau", "chau"))
    return "nepali" if exact_hits + joined_hits >= 2 else "english"

def _get_nepali_empty_response() -> dict:
    return {
        "transcript": "",
        "intent":     "UNKNOWN",
        "emotion":    "neutral",
        "animation":  "blink",
        "response":   "सुनिएन! अलि जोरले बोलिदिनुस् 😊",
        "confidence": 0.0,
        "language":   "nepali",
    }

def _get_english_empty_response() -> dict:
    return {
        "transcript": "",
        "intent":     "UNKNOWN",
        "emotion":    "neutral",
        "animation":  "blink",
        "response":   "Hmm, I didn't quite catch that! Could you say it again? 😊",
        "confidence": 0.0,
        "language":   "english",
    }


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
    background_tasks: BackgroundTasks,
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
        from models.schemas import LLMResponse
        return VoiceQueryResponse(
            transcript="",
            intent="UNKNOWN",
            emotion="neutral",
            animation="blink",
            response="Hmm, I didn't quite catch that! Could you say it again a little louder? 😊",
            confidence=0.0,
        )

    # Detect language from transcript
    detected_lang = detect_language(transcript)
    logger.info(f"[{session_id}] Language detected: {detected_lang}")

    # Layer 1: Filter child's input before sending to LLM
    filter_result = check_content(transcript)
    if not filter_result.is_safe:
        logger.info(f"[{session_id}] Content blocked [{filter_result.category}]")
        background_tasks.add_task(memory.add_turn, session_id, transcript, filter_result.redirect_response)
        background_tasks.add_task(_record_usage_event, session_id)
        return VoiceQueryResponse(
            transcript=transcript,
            intent="UNKNOWN",
            emotion=filter_result.emotion,
            animation=resolve_animation(filter_result.emotion, filter_result.animation),
            response=filter_result.redirect_response,
            confidence=1.0,
        )

    try:
        history, facts_prompt = await asyncio.gather(
            asyncio.to_thread(memory.get_history, session_id),
            asyncio.to_thread(memory.get_facts_prompt, session_id),
        )
    except Exception as exc:
        logger.warning(f"[{session_id}] Memory unavailable; continuing without it: {exc}")
        history, facts_prompt = [], ""

    # Pass detected language to LLM so it replies in the same language
    try:
        llm_result = await llm.get_response(transcript, history, facts_prompt, language=detected_lang)
    except Exception as e:
        logger.error(f"LLM failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI response failed: {str(e)}")

    # Layer 2: Filter LLM output too
    llm_result.response = sanitize_response(llm_result.response)
    background_tasks.add_task(memory.add_turn, session_id, transcript, llm_result.response)
    background_tasks.add_task(_record_usage_event, session_id)
    animation = resolve_animation(llm_result.emotion.value, llm_result.animation.value)

    # Response language — use detected OR check response text
    response_lang = detect_language(llm_result.response) if llm_result.response else detected_lang
    logger.info(f"[{session_id}] Response language: {response_lang}")

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
    background_tasks: BackgroundTasks,
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

    # Detect language from transcript
    detected_lang = detect_language(transcript)
    logger.info(f"[Pi/{session_id}] Language detected: {detected_lang}")

    # Layer 1: Filter child's input
    filter_result = check_content(transcript)
    if not filter_result.is_safe:
        logger.info(f"[Pi/{session_id}] Content blocked [{filter_result.category}]")
        background_tasks.add_task(memory.add_turn, session_id, transcript, filter_result.redirect_response)
        background_tasks.add_task(_record_usage_event, session_id)
        return {
            "transcript": transcript,
            "intent":     "UNKNOWN",
            "emotion":    filter_result.emotion,
            "animation":  resolve_animation(filter_result.emotion, filter_result.animation),
            "response":   filter_result.redirect_response,
            "confidence": 1.0,
        }

    try:
        history, facts_prompt = await asyncio.gather(
            asyncio.to_thread(memory.get_history, session_id),
            asyncio.to_thread(memory.get_facts_prompt, session_id),
        )
    except Exception as exc:
        logger.warning(f"[Pi/{session_id}] Memory unavailable; continuing without it: {exc}")
        history, facts_prompt = [], ""

    try:
        llm_result = await llm.get_response(transcript, history, facts_prompt, language=detected_lang)
    except Exception as e:
        logger.error(f"[Pi] LLM failed: {e}")
        raise HTTPException(status_code=502, detail=f"LLM failed: {str(e)}")

    # Layer 2: Filter LLM output
    llm_result.response = sanitize_response(llm_result.response)
    background_tasks.add_task(memory.add_turn, session_id, transcript, llm_result.response)
    background_tasks.add_task(_record_usage_event, session_id)
    animation = resolve_animation(llm_result.emotion.value, llm_result.animation.value)

    logger.info(f"[Pi/{session_id}] [{llm_result.emotion.value}] {llm_result.response[:80]}")

    return {
        "transcript": transcript,
        "intent":     llm_result.intent.value,
        "emotion":    llm_result.emotion.value,
        "animation":  animation,
        "response":   llm_result.response,
        "confidence": llm_result.confidence,
        "language":   detected_lang,
    }


@router.get("/questions/{session_id}")
async def get_questions(session_id: str):
    """List the child's voice questions and the AI's answers for the parent
    dashboard's Questions Asked card, newest-first."""
    transcript = memory.get_full_transcript(session_id)

    questions = []
    i = 0
    while i < len(transcript):
        row = transcript[i]
        if row["role"] == "user":
            answer = None
            if i + 1 < len(transcript) and transcript[i + 1]["role"] == "assistant":
                answer = transcript[i + 1]["content"]
            questions.append({
                "id": i,
                "question": row["content"],
                "answer": answer,
                "timestamp": row["timestamp"],
            })
        i += 1

    questions.reverse()
    return {"questions": questions, "total": len(questions)}


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
