"""
Monto AI — STT Service
Primary: GPU Whisper (when USE_LOCAL_GPU=true)
Fallback: Groq cloud Whisper (auto if GPU unreachable)

If GPU is offline → automatically uses Groq. No manual change needed.
"""
import os
import tempfile
import logging
import httpx
from difflib import SequenceMatcher
from services.groq_key_pool import (
    GroqClientPool, is_network_groq_error, is_retryable_groq_error, load_groq_keys,
)

logger = logging.getLogger(__name__)

MIN_AUDIO_BYTES = 4_000

# On short, quiet, or unclear audio, Whisper occasionally hallucinates by
# echoing back its own `prompt` bias text instead of transcribing — that
# leaked prompt then gets sent to the LLM as if it were what the child said,
# which produces bizarre replies (e.g. the LLM "continuing" a conversation
# example it was told to preserve). Treat a near-match to the prompt as no
# speech detected rather than passing it downstream.
ECHO_SIMILARITY_THRESHOLD = 0.5


def _looks_like_prompt_echo(text: str, prompt: str) -> bool:
    if not text or not prompt:
        return False
    ratio = SequenceMatcher(None, text.lower(), prompt.lower()).ratio()
    return ratio >= ECHO_SIMILARITY_THRESHOLD

DEFAULT_TRANSCRIPTION_PROMPT = (
    "Monto, Hey Monto, Kavya. A child speaking natural Nepali, Romanized "
    "Nepali, or English. Common respectful Nepali words include hajur, tapai, "
    "tapai ko, hunuhunchha, garnuhos, सक्नुहुन्छ, तपाईं, हजुर, नमस्ते. "
    "Transcribe exactly what was spoken; do not translate, paraphrase, or "
    "convert Nepali speech into Hindi. Preserve names and questions."
)


class STTService:
    def __init__(self, api_key: str = ""):
        self.use_local   = os.getenv("USE_LOCAL_GPU", "false").lower() == "true"
        self.whisper_url = os.getenv("GPU_WHISPER_URL", "http://192.168.1.100:5001")
        self.gpu_key     = os.getenv("GPU_SERVER_API_KEY", "monto-secret-2024")

        # Key pool rotates immediately on quota/auth/server failures.
        self._groq_pool  = GroqClientPool(load_groq_keys(api_key))
        self._groq_model = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")
        self._has_groq   = len(self._groq_pool) > 0
        logger.info("STT: %d Groq key(s) available", len(self._groq_pool))
        if self.use_local:
            logger.info(f"✅ STT: GPU Whisper → {self.whisper_url} (Groq fallback: {'yes' if self._has_groq else 'no'})")
        else:
            logger.info("✅ STT: Groq cloud")

    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm", prompt: str | None = None, language: str | None = None, translate_to_english: bool = False) -> str:
        if not audio_bytes:
            raise ValueError("Empty audio received")

        if len(audio_bytes) < MIN_AUDIO_BYTES:
            logger.warning(f"Audio too small ({len(audio_bytes)} bytes)")
            return ""

        logger.info(f"STT: {len(audio_bytes):,} bytes [{filename}]")

        if self.use_local:
            try:
                return await self._transcribe_gpu(audio_bytes, filename, prompt, language, translate_to_english)
            except Exception as e:
                if self._has_groq:
                    logger.warning(f"GPU STT failed ({e}) — falling back to Groq")
                    return await self._transcribe_groq(audio_bytes, filename, prompt, language, translate_to_english)
                raise
        else:
            if not self._has_groq:
                raise RuntimeError("No STT service available. Set GROQ_API_KEY or USE_LOCAL_GPU=true")
            return await self._transcribe_groq(audio_bytes, filename, prompt, language, translate_to_english)

    async def _transcribe_gpu(self, audio_bytes: bytes, filename: str, prompt: str | None = None, language: str | None = None, translate_to_english: bool = False) -> str:
        suffix       = self._suffix(filename)
        tmp_path     = self._write_temp(audio_bytes, suffix)
        used_prompt  = prompt or os.getenv("WHISPER_PROMPT", DEFAULT_TRANSCRIPTION_PROMPT)
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                with open(tmp_path, "rb") as f:
                    resp = await client.post(
                        f"{self.whisper_url}/v1/audio/transcriptions",
                        headers={"Authorization": f"Bearer {self.gpu_key}"},
                        files={"file": (filename, f, self._mime(suffix))},
                        data={k: v for k, v in {
                            "language": language,
                            "prompt": used_prompt,
                            "task": "translate" if translate_to_english else None,
                        }.items() if v},
                    )
                resp.raise_for_status()
                text = resp.json().get("text", "").strip()
                if _looks_like_prompt_echo(text, used_prompt):
                    logger.warning(f"GPU STT echoed the prompt instead of transcribing; discarding: '{text[:80]}'")
                    return ""
                logger.info(f"GPU STT: '{text[:80]}'")
                return text
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            raise RuntimeError(f"GPU Whisper unreachable: {e}")
        finally:
            self._del_temp(tmp_path)

    async def _transcribe_groq(self, audio_bytes: bytes, filename: str, prompt: str | None = None, language: str | None = None, translate_to_english: bool = False) -> str:
        suffix = self._suffix(filename)
        tmp_path = self._write_temp(audio_bytes, suffix)
        used_prompt = prompt or os.getenv("WHISPER_PROMPT", DEFAULT_TRANSCRIPTION_PROMPT)
        last_error: Exception | None = None
        try:
            for key_index, client in self._groq_pool.candidates():
                try:
                    with open(tmp_path, "rb") as audio_file:
                        if translate_to_english:
                            result = await client.audio.translations.create(
                                model="whisper-large-v3",
                                file=(filename, audio_file, self._mime(suffix)),
                                temperature=0,
                                response_format="json",
                                language="en",
                                prompt=used_prompt,
                            )
                        else:
                            result = await client.audio.transcriptions.create(
                                model=self._groq_model,
                                file=(filename, audio_file, self._mime(suffix)),
                                temperature=0,
                                response_format="verbose_json",
                                language=language or os.getenv("WHISPER_LANGUAGE", None) or None,
                                prompt=used_prompt,
                            )
                    self._groq_pool.mark_success(key_index)
                    text = result.text.strip()
                    lang = getattr(result, "language", "?")
                    logger.info("Groq STT [%s%s] succeeded with key slot %d", lang, " -> English" if translate_to_english else "", key_index + 1)
                    if hasattr(result, "segments") and result.segments:
                        def segment_value(segment, key, default=0):
                            return segment.get(key, default) if isinstance(segment, dict) else getattr(segment, key, default)
                        avg_no_speech = sum(segment_value(segment, "no_speech_prob") for segment in result.segments) / len(result.segments)
                        if avg_no_speech > 0.8:
                            logger.warning("STT: high silence probability %.2f; discarding", avg_no_speech)
                            return ""
                    if _looks_like_prompt_echo(text, used_prompt):
                        logger.warning(f"Groq STT echoed the prompt instead of transcribing; discarding: '{text[:80]}'")
                        return ""
                    return text
                except Exception as error:
                    last_error = error
                    if is_network_groq_error(error):
                        # DNS/connectivity failures affect every key equally.
                        # The Groq SDK has already retried this request, so fail
                        # fast and leave healthy keys out of cooldown.
                        logger.warning("Groq STT network unavailable (%s)", type(error).__name__)
                        raise RuntimeError("Speech service network unavailable. Please try again.") from error
                    if not is_retryable_groq_error(error):
                        raise
                    self._groq_pool.mark_failed(key_index, error)
                    logger.warning("Groq STT key slot %d unavailable (%s); trying next", key_index + 1, type(error).__name__)
            if last_error:
                raise last_error
            raise RuntimeError("No Groq STT API key is configured")
        finally:
            self._del_temp(tmp_path)
    def _write_temp(self, data: bytes, suffix: str) -> str:
        fd, path = tempfile.mkstemp(suffix=suffix)
        try:
            os.write(fd, data)
        finally:
            os.close(fd)
        return path

    def _del_temp(self, path: str):
        try:
            os.unlink(path)
        except OSError:
            pass

    def _suffix(self, filename: str) -> str:
        return ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ".webm"

    def _mime(self, suffix: str) -> str:
        return {
            ".wav": "audio/wav", ".mp3": "audio/mpeg", ".mp4": "audio/mp4",
            ".ogg": "audio/ogg", ".webm": "audio/webm", ".m4a": "audio/mp4",
        }.get(suffix, "audio/webm")
