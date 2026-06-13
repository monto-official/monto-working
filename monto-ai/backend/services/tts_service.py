"""
Monto AI — TTS Service

Priority order:
  English:
    GPU mode  → Piper (offline, fast WAV)
    Cloud mode → ElevenLabs (high quality MP3)
    Fallback  → Browser TTS

  Nepali:
    GPU mode  → GPU Nepali server (Edge TTS / gTTS)
    Cloud mode → Edge TTS directly from backend (free, Microsoft neural)
    Fallback  → gTTS (requires internet)

Microsoft Edge TTS voices for Nepali:
  ne-NP-HemkalaNeural (Female) ← best for kids
  ne-NP-SagarNeural   (Male)
"""
import os
import io
import asyncio
import logging
import httpx

logger = logging.getLogger(__name__)


def _is_nepali(text: str) -> bool:
    """Detect Devanagari script in text."""
    return any('\u0900' <= ch <= '\u097F' for ch in text)


class TTSService:
    def __init__(self, api_key: str = ""):
        self.use_local   = os.getenv("USE_LOCAL_GPU", "false").lower() == "true"
        self.enabled     = True
        self.audio_format = "audio/mpeg"

        # Nepali Edge TTS voice
        self.nepali_voice = os.getenv("NEPALI_VOICE", "ne-NP-HemkalaNeural")

        if self.use_local:
            self.piper_url     = os.getenv("GPU_PIPER_URL",      "http://192.168.1.100:5002")
            self.nepali_url    = os.getenv("GPU_NEPALI_TTS_URL", "http://192.168.1.100:5003")
            self.gpu_key       = os.getenv("GPU_SERVER_API_KEY", "monto-secret-2024")
            self.default_voice = os.getenv("PIPER_DEFAULT_VOICE", "en_US-amy-medium")
            self.audio_format  = "audio/wav"

            # ElevenLabs as English fallback
            if api_key:
                self._init_elevenlabs(api_key)
                logger.info(f"✅ TTS: GPU Piper(EN) + Edge TTS(NE) | ElevenLabs fallback: yes")
            else:
                self._has_elevenlabs = False
                logger.info(f"✅ TTS: GPU Piper(EN) + Edge TTS(NE)")
        else:
            # Cloud mode: ElevenLabs for English, Edge TTS for Nepali
            if not api_key:
                logger.warning("⚠️  No ElevenLabs key — English TTS disabled, Nepali via Edge TTS")
                self._has_elevenlabs = False
            else:
                self._init_elevenlabs(api_key)
                logger.info(f"✅ TTS: ElevenLabs(EN) + Edge TTS(NE)")

    def _init_elevenlabs(self, api_key: str):
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
        self._has_elevenlabs = True

    # ── PUBLIC ────────────────────────────────────────────────────────────────

    async def synthesize(
        self,
        text:     str,
        voice:    str = "monto",
        emotion:  str = "neutral",
        language: str = "english",
    ) -> bytes:
        if not text.strip():
            raise ValueError("Empty text")

        # Gentle pause for calm emotions
        if emotion in ("sad", "thinking"):
            text = f"... {text}"

        # Detect language
        nepali = language == "nepali" or _is_nepali(text)

        if nepali:
            return await self._synthesize_nepali_with_fallback(text)
        else:
            return await self._synthesize_english(text, voice, emotion)

    # ── NEPALI ────────────────────────────────────────────────────────────────

    async def _synthesize_nepali_with_fallback(self, text: str) -> bytes:
        """Nepali TTS: GPU server → Edge TTS → gTTS fallback."""

        # 1. Try GPU Nepali server (has Edge TTS inside)
        if self.use_local:
            try:
                result = await self._synthesize_gpu_nepali(text)
                self.audio_format = "audio/mpeg"
                return result
            except Exception as e:
                logger.warning(f"GPU Nepali TTS failed ({e}) — trying Edge TTS direct")

        # 2. Edge TTS directly from backend (free, works in both modes)
        try:
            result = await self._synthesize_edge_tts(text, self.nepali_voice)
            self.audio_format = "audio/mpeg"
            logger.info(f"Edge TTS Nepali [{self.nepali_voice}]: {len(result)} bytes")
            return result
        except Exception as e:
            logger.warning(f"Edge TTS failed ({e}) — trying gTTS fallback")

        # 3. gTTS fallback
        try:
            result = await self._synthesize_gtts(text, lang="ne")
            self.audio_format = "audio/mpeg"
            logger.info(f"gTTS Nepali: {len(result)} bytes")
            return result
        except Exception as e:
            raise RuntimeError(f"All Nepali TTS options failed: {e}")

    async def _synthesize_gpu_nepali(self, text: str) -> bytes:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{self.nepali_url}/v1/tts/nepali",
                headers={"Authorization": f"Bearer {self.gpu_key}"},
                json={"text": text},
            )
            resp.raise_for_status()
            return resp.content

    async def _synthesize_edge_tts(self, text: str, voice: str) -> bytes:
        """Use Microsoft Edge TTS — free, high quality, works offline via edge-tts library."""
        import edge_tts
        buf = io.BytesIO()
        communicate = edge_tts.Communicate(text, voice)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        buf.seek(0)
        data = buf.read()
        if not data:
            raise RuntimeError("Edge TTS returned empty audio")
        return data

    async def _synthesize_gtts(self, text: str, lang: str = "ne") -> bytes:
        """gTTS fallback — requires internet."""
        from gtts import gTTS
        buf = io.BytesIO()
        tts = gTTS(text=text, lang=lang, slow=False)
        tts.write_to_fp(buf)
        buf.seek(0)
        return buf.read()

    # ── ENGLISH ───────────────────────────────────────────────────────────────

    async def _synthesize_english(self, text: str, voice: str, emotion: str) -> bytes:
        """English TTS: GPU Piper → ElevenLabs → Edge TTS fallback."""

        # GPU Piper
        if self.use_local:
            try:
                result = await self._synthesize_piper(text, voice, emotion)
                self.audio_format = "audio/wav"
                return result
            except Exception as e:
                logger.warning(f"Piper failed ({e}) — falling back")

        # ElevenLabs
        if getattr(self, "_has_elevenlabs", False):
            try:
                result = await self._synthesize_elevenlabs(text, voice, emotion)
                self.audio_format = "audio/mpeg"
                return result
            except Exception as e:
                logger.warning(f"ElevenLabs failed ({e}) — trying Edge TTS")

        # Edge TTS English fallback
        try:
            result = await self._synthesize_edge_tts(text, "en-US-AriaNeural")
            self.audio_format = "audio/mpeg"
            logger.info(f"Edge TTS English fallback: {len(result)} bytes")
            return result
        except Exception as e:
            raise RuntimeError(f"All English TTS options failed: {e}")

    async def _synthesize_piper(self, text: str, voice: str, emotion: str) -> bytes:
        piper_voice = voice if "-" in voice else self.default_voice
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.piper_url}/v1/tts/synthesize",
                headers={"Authorization": f"Bearer {self.gpu_key}"},
                json={"text": text, "voice": piper_voice, "emotion": emotion},
            )
            resp.raise_for_status()
            logger.info(f"Piper TTS [{emotion}]: {len(resp.content)} bytes")
            return resp.content

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
