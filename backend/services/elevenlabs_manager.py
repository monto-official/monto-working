"""Fault-tolerant ElevenLabs v3 client with in-memory API-key rotation."""
from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Iterable

logger = logging.getLogger(__name__)


class ElevenLabsUnavailableError(RuntimeError):
    """Raised when no configured ElevenLabs API key can serve the request."""


class ElevenLabsManager:
    """Generate speech while transparently rotating unusable API keys.

    Keys that fail due to authentication, quota, credit, or rate-limit errors
    are disabled for this process lifetime. Call ``reset_failed_keys`` only
    after quotas or credentials have been repaired.
    """

    _ROTATABLE_STATUS_CODES = {401, 402, 403, 429}
    _ROTATABLE_MARKERS = (
        "quota", "credit", "rate limit", "rate_limit", "too many requests",
        "invalid api key", "invalid_api_key", "authentication", "unauthorized",
        "forbidden", "subscription", "payment required",
    )

    def __init__(
        self,
        api_keys: Iterable[str] | None = None,
        *,
        voice_id: str | None = None,
        model_id: str | None = None,
        output_format: str = "mp3_44100_128",
    ) -> None:
        self.api_keys = self._normalise_keys(api_keys or self.load_api_keys())
        self.voice_id = voice_id or os.getenv("ELEVENLABS_VOICE_ID", "cgSgspJ2msm6clMCkdW9")
        self.model_id = model_id or os.getenv("ELEVENLABS_MODEL_ID", "eleven_v3")
        self.output_format = output_format
        self._active_index = 0
        self._failed_indices: set[int] = set()
        self._clients: dict[int, object] = {}
        self._rotation_lock = asyncio.Lock()

        if self.api_keys:
            logger.info(
                "ElevenLabs ready with %d key(s); active=%s model=%s",
                len(self.api_keys), self._mask_key(self.api_keys[0]), self.model_id,
            )
        else:
            logger.warning("No ElevenLabs API keys configured")

    @staticmethod
    def load_api_keys() -> list[str]:
        """Load comma/newline-separated and numbered environment variables."""
        keys: list[str] = []
        combined = os.getenv("ELEVENLABS_API_KEYS", "")
        keys.extend(part.strip() for part in combined.replace("\n", ",").split(","))
        keys.append(os.getenv("ELEVENLABS_API_KEY", "").strip())
        index = 1
        while True:
            value = os.getenv(f"ELEVENLABS_API_KEY_{index}")
            if value is None:
                break
            keys.append(value.strip())
            index += 1
        return ElevenLabsManager._normalise_keys(keys)

    @staticmethod
    def _normalise_keys(keys: Iterable[str]) -> list[str]:
        # dict preserves priority while removing blanks and duplicates.
        return list(dict.fromkeys(key.strip() for key in keys if key and key.strip()))

    @staticmethod
    def _mask_key(key: str) -> str:
        if len(key) <= 8:
            return "****"
        return f"{key[:4]}…{key[-4:]}"

    @property
    def available(self) -> bool:
        return any(i not in self._failed_indices for i in range(len(self.api_keys)))

    def reset_failed_keys(self) -> None:
        self._failed_indices.clear()
        self._active_index = 0
        logger.info("ElevenLabs failed-key state reset")

    def _client(self, index: int):
        if index not in self._clients:
            from elevenlabs.client import AsyncElevenLabs
            self._clients[index] = AsyncElevenLabs(api_key=self.api_keys[index])
        return self._clients[index]

    def _next_available_index(self, start: int) -> int | None:
        for offset in range(len(self.api_keys)):
            index = (start + offset) % len(self.api_keys)
            if index not in self._failed_indices:
                return index
        return None

    @classmethod
    def _is_key_failure(cls, exc: Exception) -> bool:
        status = getattr(exc, "status_code", None)
        response = getattr(exc, "response", None)
        status = status or getattr(response, "status_code", None)
        message = str(exc).lower()
        return status in cls._ROTATABLE_STATUS_CODES or any(marker in message for marker in cls._ROTATABLE_MARKERS)

    async def generate(
        self,
        text: str,
        *,
        voice_id: str | None = None,
        voice_settings=None,
        language_code: str | None = None,
    ) -> bytes:
        """Generate MP3 bytes, rotating keys and retrying the same text."""
        if not text.strip():
            raise ValueError("Text cannot be empty")
        if not self.api_keys:
            raise ElevenLabsUnavailableError("ElevenLabs TTS is not configured")

        attempted: set[int] = set()
        while len(attempted) < len(self.api_keys):
            async with self._rotation_lock:
                index = self._next_available_index(self._active_index)
                if index is None:
                    break
                attempted.add(index)

            logger.info("Using ElevenLabs API key %s", self._mask_key(self.api_keys[index]))
            try:
                chunks = self._client(index).text_to_speech.convert(
                    voice_id=voice_id or self.voice_id,
                    text=text,
                    model_id=self.model_id,
                    voice_settings=voice_settings,
                    output_format=self.output_format,
                    language_code=language_code,
                    apply_text_normalization="on",
                )
                audio = bytearray()
                async for chunk in chunks:
                    if chunk:
                        audio.extend(chunk)
                if not audio:
                    raise RuntimeError("ElevenLabs returned empty audio")
                async with self._rotation_lock:
                    self._active_index = index
                return bytes(audio)
            except Exception as exc:
                if not self._is_key_failure(exc):
                    raise
                async with self._rotation_lock:
                    self._failed_indices.add(index)
                    next_index = self._next_available_index(index + 1)
                    if next_index is not None:
                        self._active_index = next_index
                logger.warning(
                    "Disabling ElevenLabs key %s for this runtime: %s",
                    self._mask_key(self.api_keys[index]), type(exc).__name__,
                )

        raise ElevenLabsUnavailableError(
            "Speech generation is temporarily unavailable because all configured TTS providers are exhausted or unauthorized"
        )
