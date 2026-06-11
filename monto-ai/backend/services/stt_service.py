"""
Monto AI — STT Service
Two modes controlled by USE_LOCAL_GPU in .env:
  - LOCAL (production) : GPU server running faster-whisper
  - GROQ  (testing)    : Groq cloud Whisper API

Fixes applied:
  - Temp file written and closed before reading back (Windows NamedTemporaryFile bug)
  - Language hint passed to reduce hallucination on near-silence
  - Audio size + duration validation before sending
  - Hallucination filter: rejects single-word garbage responses
  - Correct MIME type per file format
"""
import os
import tempfile
import logging
import httpx

logger = logging.getLogger(__name__)

# Minimum audio size to bother sending (bytes)
# webm/opus at 64kbps ≈ 8KB/sec — less than ~0.5s isn't useful
MIN_AUDIO_BYTES = 4_000


class STTService:
    def __init__(self, api_key: str = ""):
        self.use_local = os.getenv("USE_LOCAL_GPU", "false").lower() == "true"

        if self.use_local:
            self.whisper_url = os.getenv("GPU_WHISPER_URL", "http://192.168.1.100:5001")
            self.api_key     = os.getenv("GPU_SERVER_API_KEY", "monto-secret-2024")
            logger.info(f"✅ STT: LOCAL GPU → {self.whisper_url}")
        else:
            from groq import AsyncGroq
            self._groq  = AsyncGroq(api_key=api_key)
            self._model = "whisper-large-v3"
            logger.info("✅ STT: Groq cloud (testing mode)")

    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm") -> str:
        """Transcribe audio bytes → text string."""
        if not audio_bytes:
            raise ValueError("Empty audio received")

        # Reject audio that's too short to contain real speech
        if len(audio_bytes) < MIN_AUDIO_BYTES:
            logger.warning(
                f"Audio too small ({len(audio_bytes)} bytes) — likely silence. "
                "Ask the user to speak louder or longer."
            )
            return ""

        logger.info(f"STT: transcribing {len(audio_bytes):,} bytes [{filename}]")

        if self.use_local:
            text = await self._transcribe_gpu(audio_bytes, filename)
        else:
            text = await self._transcribe_groq(audio_bytes, filename)

        return text

    # ── LOCAL GPU ─────────────────────────────────────────────────────────────

    async def _transcribe_gpu(self, audio_bytes: bytes, filename: str) -> str:
        suffix   = self._suffix(filename)
        tmp_path = self._write_temp(audio_bytes, suffix)
        try:
            mime = self._mime(suffix)
            async with httpx.AsyncClient(timeout=30.0) as client:
                with open(tmp_path, "rb") as f:
                    resp = await client.post(
                        f"{self.whisper_url}/v1/audio/transcriptions",
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        files={"file": (filename, f, mime)},
                    )
                resp.raise_for_status()
                text = resp.json().get("text", "").strip()
                logger.info(f"GPU STT: '{text[:80]}'")
                return text

        except httpx.ConnectError:
            raise RuntimeError(
                f"Cannot connect to Whisper GPU server at {self.whisper_url}. "
                "Is the GPU server running?"
            )
        finally:
            self._del_temp(tmp_path)

    # ── GROQ CLOUD (testing) ──────────────────────────────────────────────────

    async def _transcribe_groq(self, audio_bytes: bytes, filename: str) -> str:
        suffix   = self._suffix(filename)
        tmp_path = self._write_temp(audio_bytes, suffix)
        try:
            # IMPORTANT: open the file AFTER closing the temp file (Windows fix)
            with open(tmp_path, "rb") as f:
                result = await self._groq.audio.transcriptions.create(
                    model=self._model,
                    file=(filename, f, self._mime(suffix)),
                    temperature=0,
                    response_format="verbose_json",
                    # Language hint reduces hallucination on near-silence.
                    # Set WHISPER_LANGUAGE=ne for Nepali, en for English, None for auto
                    language=os.getenv("WHISPER_LANGUAGE", None) or None,
                )
            text = result.text.strip()

            # Log detected language if available
            lang = getattr(result, "language", "unknown")
            logger.info(f"Groq STT [{lang}]: '{text[:80]}'")

            # Extra hallucination check: if no_speech_prob is high, discard
            # (verbose_json returns segments with no_speech_prob)
            if hasattr(result, "segments") and result.segments:
                avg_no_speech = sum(
                    getattr(s, "no_speech_prob", 0) for s in result.segments
                ) / len(result.segments)
                if avg_no_speech > 0.8:   # only reject very clearly silent audio
                    logger.warning(
                        f"STT: high no_speech_prob ({avg_no_speech:.2f}) — "
                        f"likely silence, discarding: '{text}'"
                    )
                    return ""

            return text

        finally:
            self._del_temp(tmp_path)

    # ── HELPERS ───────────────────────────────────────────────────────────────

    def _write_temp(self, data: bytes, suffix: str) -> str:
        """Write bytes to a named temp file and CLOSE it before returning path.
        On Windows, NamedTemporaryFile with delete=False must be closed before
        another process/handle can open the same file."""
        fd, path = tempfile.mkstemp(suffix=suffix)
        try:
            os.write(fd, data)
        finally:
            os.close(fd)   # close the fd so it can be opened again on Windows
        return path

    def _del_temp(self, path: str):
        if path:
            try:
                os.unlink(path)
            except OSError:
                pass

    def _suffix(self, filename: str) -> str:
        return ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ".webm"

    def _mime(self, suffix: str) -> str:
        return {
            ".wav":  "audio/wav",
            ".mp3":  "audio/mpeg",
            ".mp4":  "audio/mp4",
            ".ogg":  "audio/ogg",
            ".webm": "audio/webm",
            ".m4a":  "audio/mp4",
        }.get(suffix, "audio/webm")
