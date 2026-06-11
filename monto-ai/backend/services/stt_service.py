"""
Monto AI — STT Service
Two modes controlled by USE_LOCAL_GPU in .env:
  - LOCAL (production) : GPU server running faster-whisper → fast, private, free
  - GROQ  (testing)    : Groq cloud Whisper API → easy to test, needs API key
"""
import os
import tempfile
import logging
import httpx

logger = logging.getLogger(__name__)


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

    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.wav") -> str:
        """Transcribe audio bytes → text string."""
        if not audio_bytes:
            raise ValueError("Empty audio received")

        if self.use_local:
            return await self._transcribe_gpu(audio_bytes, filename)
        else:
            return await self._transcribe_groq(audio_bytes, filename)

    # ── LOCAL GPU ─────────────────────────────────────────────────────────────

    async def _transcribe_gpu(self, audio_bytes: bytes, filename: str) -> str:
        suffix   = self._suffix(filename)
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            mime = "audio/wav" if suffix == ".wav" else "audio/webm"
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
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    # ── GROQ CLOUD (testing) ──────────────────────────────────────────────────

    async def _transcribe_groq(self, audio_bytes: bytes, filename: str) -> str:
        suffix   = self._suffix(filename)
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            with open(tmp_path, "rb") as f:
                result = await self._groq.audio.transcriptions.create(
                    model=self._model,
                    file=f,
                    temperature=0,
                    response_format="verbose_json",
                )
            text = result.text.strip()
            logger.info(f"Groq STT: '{text[:80]}'")
            return text

        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    def _suffix(self, filename: str) -> str:
        return ("." + filename.rsplit(".", 1)[-1]) if "." in filename else ".wav"
