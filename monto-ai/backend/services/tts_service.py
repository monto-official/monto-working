"""
Monto AI — TTS Service
Two modes controlled by USE_LOCAL_GPU in .env:
  - LOCAL (production) : GPU server running Piper → free, offline, fast WAV
  - ELEVENLABS (testing): ElevenLabs cloud API → high quality, needs API key

Both return raw audio bytes. Local returns WAV, ElevenLabs returns MP3.
"""
import os
import logging
import httpx

logger = logging.getLogger(__name__)


class TTSService:
    def __init__(self, api_key: str = ""):
        self.use_local = os.getenv("USE_LOCAL_GPU", "false").lower() == "true"
        self.enabled   = True

        if self.use_local:
            self.piper_url     = os.getenv("GPU_PIPER_URL",       "http://192.168.1.100:5002")
            self.nepali_url    = os.getenv("GPU_NEPALI_TTS_URL",  "http://192.168.1.100:5003")
            self.api_key       = os.getenv("GPU_SERVER_API_KEY",   "monto-secret-2024")
            self.default_voice = os.getenv("PIPER_DEFAULT_VOICE",  "en_US-amy-medium")
            self.audio_format  = "audio/wav"
            logger.info(f"✅ TTS: LOCAL Piper (EN) → {self.piper_url} | Nepali (gTTS) → {self.nepali_url}")
        else:
            if not api_key:
                logger.warning("⚠️  No ElevenLabs key — TTS disabled")
                self.enabled = False
                return
            from elevenlabs.client import AsyncElevenLabs
            from elevenlabs import VoiceSettings
            self._el          = AsyncElevenLabs(api_key=api_key)
            self._model_id    = "eleven_turbo_v2_5"
            self._voice_map   = {
                "female": os.getenv("TTS_VOICE_FEMALE", "EXAVITQu4vr4xnSDxMaL"),
                "male":   os.getenv("TTS_VOICE_MALE",   "TxGEqnHWrfWFTfGW9XjX"),
                "monto":  os.getenv("TTS_VOICE_MONTO",  "EXAVITQu4vr4xnSDxMaL"),
            }
            self._emotion_settings = {
                "happy":     VoiceSettings(stability=0.45, similarity_boost=0.80, style=0.35, use_speaker_boost=True),
                "excited":   VoiceSettings(stability=0.38, similarity_boost=0.78, style=0.50, use_speaker_boost=True),
                "sad":       VoiceSettings(stability=0.70, similarity_boost=0.85, style=0.10, use_speaker_boost=True),
                "thinking":  VoiceSettings(stability=0.60, similarity_boost=0.80, style=0.20, use_speaker_boost=True),
                "surprised": VoiceSettings(stability=0.35, similarity_boost=0.78, style=0.55, use_speaker_boost=True),
                "neutral":   VoiceSettings(stability=0.55, similarity_boost=0.80, style=0.20, use_speaker_boost=True),
            }
            self.audio_format = "audio/mpeg"
            logger.info("✅ TTS: ElevenLabs cloud (testing mode)")

    async def synthesize(
        self,
        text:     str,
        voice:    str = "monto",
        emotion:  str = "neutral",
        language: str = "english",
    ) -> bytes:
        """Convert text → audio bytes. Format depends on mode (WAV/MP3)."""
        if not text.strip():
            raise ValueError("Empty text")

        # Gentle pause prefix for calm emotions
        if emotion in ("sad", "thinking"):
            text = f"... {text}"

        if self.use_local:
            # Route Nepali to gTTS server, English to Piper
            if language == "nepali" or self._detect_nepali(text):
                return await self._synthesize_nepali(text)
            return await self._synthesize_piper(text, voice, emotion)
        else:
            return await self._synthesize_elevenlabs(text, voice, emotion)

    # ── LOCAL GPU (Piper) ─────────────────────────────────────────────────────

    def _detect_nepali(self, text: str) -> bool:
        """Detect if text contains Devanagari script (Nepali/Hindi)."""
        return any('\u0900' <= ch <= '\u097F' for ch in text)

    async def _synthesize_nepali(self, text: str) -> bytes:
        """Send Nepali text to gTTS server, returns MP3 bytes."""
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    f"{self.nepali_url}/v1/tts/nepali",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"text": text, "slow": False},
                )
                resp.raise_for_status()
                self.audio_format = "audio/mpeg"   # gTTS returns MP3
                logger.info(f"Nepali TTS: {len(resp.content)} bytes")
                return resp.content
        except httpx.ConnectError:
            raise RuntimeError(
                f"Cannot connect to Nepali TTS server at {self.nepali_url}"
            )─

    async def _synthesize_piper(self, text: str, voice: str, emotion: str) -> bytes:
        # Use voice as Piper voice name if it looks like one, else use default
        piper_voice = voice if "-" in voice else self.default_voice

        payload = {
            "text":    text,
            "voice":   piper_voice,
            "emotion": emotion,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.piper_url}/v1/tts/synthesize",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=payload,
                )
                resp.raise_for_status()
                logger.info(f"Piper TTS [{emotion}]: {len(resp.content)} bytes")
                return resp.content

        except httpx.ConnectError:
            raise RuntimeError(
                f"Cannot connect to Piper server at {self.piper_url}. "
                "Is the GPU server running?"
            )

    # ── ELEVENLABS CLOUD (testing) ────────────────────────────────────────────

    async def _synthesize_elevenlabs(self, text: str, voice: str, emotion: str) -> bytes:
        voice_id = self._voice_map.get(voice, self._voice_map["monto"])
        settings = self._emotion_settings.get(emotion, self._emotion_settings["neutral"])

        audio_bytes = b""
        async for chunk in self._el.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id=self._model_id,
            voice_settings=settings,
            output_format="mp3_44100_128",
        ):
            if chunk:
                audio_bytes += chunk

        logger.info(f"ElevenLabs TTS [{emotion}]: {len(audio_bytes)} bytes")
        return audio_bytes
