"""Groq API key pool with retryable-error failover.

Keys are loaded from GROQ_API_KEYS (comma/newline separated), GROQ_API_KEY,
and optional GROQ_API_KEY_1..GROQ_API_KEY_20 variables. Secret values are
never logged.
"""
from __future__ import annotations

import os
import re
import time
from typing import Iterable

from groq import AsyncGroq


def load_groq_keys(primary: str = "") -> list[str]:
    raw_keys: list[str] = [primary, os.getenv("GROQ_API_KEY", "")]
    raw_keys.extend(re.split(r"[,;\r\n]+", os.getenv("GROQ_API_KEYS", "")))
    raw_keys.extend(os.getenv(f"GROQ_API_KEY_{index}", "") for index in range(1, 21))

    unique: list[str] = []
    seen: set[str] = set()
    for value in raw_keys:
        key = value.strip()
        if key and key != "your_groq_api_key_here" and key not in seen:
            seen.add(key)
            unique.append(key)
    return unique


def is_network_groq_error(error: Exception) -> bool:
    """True for connectivity failures that are independent of the API key."""
    if getattr(error, "status_code", None) is not None:
        return False
    message = str(error).lower()
    name = type(error).__name__.lower()
    return any(token in message or token in name for token in (
        "connection", "connecterror", "apiconnection", "getaddrinfo", "dns", "timed out", "timeout",
    ))

def is_retryable_groq_error(error: Exception) -> bool:
    status = getattr(error, "status_code", None)
    if status in {401, 403, 408, 409, 429} or (isinstance(status, int) and status >= 500):
        return True
    message = str(error).lower()
    return any(token in message for token in (
        "rate limit", "rate_limit", "quota", "limit exceeded", "too many requests",
        "invalid api key", "authentication", "service unavailable", "timeout",
        "connection", "internal server error",
    ))


class GroqClientPool:
    def __init__(self, keys: Iterable[str]):
        clean = [key for key in keys if key]
        self._clients = [AsyncGroq(api_key=key) for key in clean]
        self._active = 0
        self._cooldowns: dict[int, float] = {}

    def __len__(self) -> int:
        return len(self._clients)

    def candidates(self):
        if not self._clients:
            return []
        now = time.monotonic()
        ordered = [(self._active + offset) % len(self._clients) for offset in range(len(self._clients))]
        ready = [index for index in ordered if self._cooldowns.get(index, 0) <= now]
        return [(index, self._clients[index]) for index in (ready or ordered)]

    def mark_success(self, index: int) -> None:
        self._active = index
        self._cooldowns.pop(index, None)

    def mark_failed(self, index: int, error: Exception) -> None:
        status = getattr(error, "status_code", None)
        cooldown = 300 if status in {401, 403} else 75
        self._cooldowns[index] = time.monotonic() + cooldown
        if len(self._clients) > 1:
            self._active = (index + 1) % len(self._clients)