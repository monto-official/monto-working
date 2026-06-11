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

logger = logging.getLogger(__name__)

MIN_AUDIO_BYTES = 4_000


class STTService:
    def __init__(self, api_key: str = ""):
        self.use_local   = os.getenv("USE_LOCAL_GPU", "false").lower() == "true"
        self.whisper_url = os.getenv("GPU_WHISPER_URL", "http://192.168.1.100:5001")
        self.gpu_key     = os.getenv("GPU_SERVER_API_KEY", "monto-secret-2024")

        # Always init Groq as fallback — needed when GPU is offline
        groq_key = api_key or os.getenv("GROQ_API_KEY", "")
        if groq_key:
            from groq import AsyncGroq
            self._groq       = AsyncGroq(api_key=groq_key)
            self._groq_model = "whisper-large-v3"
            self._has_groq   = True
        else:
            self._has_groq   = False

        if self.use_local:
            logger.info(f"✅ STT: GPU Whisper → {self.whisper_url} (Groq fallback: {'yes' if self._has_groq else 'no'})")
        else:
            logger.info("✅ STT: Groq cloud")

    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm") -> str:
        if not audio_bytes:
            raise ValueError("Empty audio received")

        if len(audio_bytes) < MIN_AUDIO_BYTES:
            logger.warning(f"Audio too small ({len(audio_bytes)} bytes)")
            return ""

        logger.info(f"STT: {len(audio_bytes):,} bytes [{filename}]")

        if self.use_local:
            try:
                return await self._transcribe_gpu(audio_bytes, filename)
            except Exception as e:
                if self._has_groq:
                    logger.warning(f"GPU STT failed ({e}) — falling back to Groq")
                    return await self._transcribe_groq(audio_bytes, filename)
                raise
        else:
            return await self._transcribe_groq(audio_bytes, filename)

    async def _transcribe_gpu(self, audio_bytes: bytes, filename: str) -> str:
        suffix   = self._suffix(filename)
        tmp_path = self._write_temp(audio_bytes, suffix)
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                with open(tmp_path, "rb") as f:
                    resp = await client.post(
                        f"{self.whisper_url}/v1/audio/transcriptions",
                        headers={"Authorization": f"Bearer {self.gpu_key}"},
                        files={"file": (filename, f, self._mime(suffix))},
                    )
                resp.raise_for_status()
                text = resp.json().get("text", "").strip()
                logger.info(f"GPU STT: '{text[:80]}'")
                return text
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            raise RuntimeError(f"GPU Whisper unreachable: {e}")
        finally:
            self._del_temp(tmp_path)

    async def _transcribe_groq(self, audio_bytes: bytes, filename: str) -> str:
        suffix   = self._suffix(filename)
        tmp_path = self._write_temp(audio_bytes, suffix)
        try:
            with open(tmp_path, "rb") as f:
                result = await self._groq.audio.transcriptions.create(
                    model=self._groq_model,
                    file=(filename, f, self._mime(suffix)),
                    temperature=0,
                    response_format="verbose_json",
                    language=os.getenv("WHISPER_LANGUAGE", None) or None,
                )
            text = result.text.strip()
            lang = getattr(result, "language", "?")
            logger.info(f"Groq STT [{lang}]: '{text[:80]}'")

            if hasattr(result, "segments") and result.segments:
                avg_no_speech = sum(
                    getattr(s, "no_speech_prob", 0) for s in result.segments
                ) / len(result.segments)
                if avg_no_speech > 0.8:
                    logger.warning(f"STT: high silence prob ({avg_no_speech:.2f}), discarding")
                    return ""
            return text
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
