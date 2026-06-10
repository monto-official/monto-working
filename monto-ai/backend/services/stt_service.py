"""
Speech-to-Text Service
Uses Groq Whisper Large V3 to transcribe audio files.
"""
import os
import tempfile
import logging
from groq import AsyncGroq

logger = logging.getLogger(__name__)


class STTService:
    def __init__(self, api_key: str):
        self.client = AsyncGroq(api_key=api_key)
        self.model = "whisper-large-v3"

    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm") -> str:
        """
        Transcribe audio bytes to text using Groq Whisper Large V3.
        Returns the transcribed text string.
        """
        if not audio_bytes:
            raise ValueError("Empty audio data received")

        # Write to a temp file so Groq SDK can read it
        suffix = self._get_suffix(filename)
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as audio_file:
                transcription = await self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    temperature=0,
                    response_format="verbose_json",
                )
            transcript = transcription.text.strip()
            logger.info(f"Transcription successful: '{transcript[:80]}...' " if len(transcript) > 80 else f"Transcription: '{transcript}'")
            return transcript
        except Exception as e:
            logger.error(f"STT error: {e}")
            raise
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    def _get_suffix(self, filename: str) -> str:
        """Extract file extension for temp file."""
        if "." in filename:
            return "." + filename.rsplit(".", 1)[-1]
        return ".webm"
