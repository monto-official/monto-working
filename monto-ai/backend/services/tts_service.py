"""
ElevenLabs TTS Service
Converts text to speech and returns raw MP3 audio bytes.
"""
import logging
from elevenlabs.client import AsyncElevenLabs
from elevenlabs import VoiceSettings

logger = logging.getLogger(__name__)

# Voice IDs — ElevenLabs built-in voices
VOICE_MAP = {
    "female": "EXAVITQu4vr4xnSDxMaL",   # Bella — warm, friendly female
    "male":   "TxGEqnHWrfWFTfGW9XjX",   # Josh — clear, friendly male
}

MODEL_ID = "eleven_turbo_v2_5"


class TTSService:
    def __init__(self, api_key: str):
        self.client = AsyncElevenLabs(api_key=api_key)
        self.enabled = True
        logger.info("✅ ElevenLabs TTS Service ready")

    async def synthesize(
        self,
        text: str,
        voice: str = "female",
        language: str = "english",
    ) -> bytes:
        """
        Convert text to speech. Returns raw MP3 bytes.
        """
        if not text.strip():
            raise ValueError("Empty text provided")

        voice_id = VOICE_MAP.get(voice, VOICE_MAP["female"])

        try:
            # convert() returns an async generator — iterate it to collect bytes
            audio_bytes = b""
            async for chunk in self.client.text_to_speech.convert(
                voice_id=voice_id,
                text=text,
                model_id=MODEL_ID,
                voice_settings=VoiceSettings(
                    stability=0.55,
                    similarity_boost=0.80,
                    style=0.25,
                    use_speaker_boost=True,
                ),
                output_format="mp3_44100_128",
            ):
                if chunk:
                    audio_bytes += chunk

            logger.info(
                f"TTS synthesized {len(audio_bytes)} bytes for: "
                f"'{text[:60]}...'" if len(text) > 60 else
                f"TTS synthesized {len(audio_bytes)} bytes for: '{text}'"
            )
            return audio_bytes

        except Exception as e:
            logger.error(f"ElevenLabs TTS error: {e}")
            raise
