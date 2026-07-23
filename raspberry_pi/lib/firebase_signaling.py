"""
Firebase Realtime Database signaling transport — Python port of
frontend/lib/firebase-signaling.ts, used so the Pi kiosk can pair/call over
the exact same channels as the web child app (and therefore the same parent
app, unmodified). Talks to Firebase over plain REST + SSE (no SDK), same as
the TS version, so the only new dependency is `requests`, already present.

Media never passes through Firebase — only ring/SDP/ICE/control messages do.
"""
import json
import logging
import re
import threading
import time
from typing import Callable, Optional

import requests

logger = logging.getLogger(__name__)

_IDENTITY_TOOLKIT_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signUp"
_PRESENCE_STALE_MS = 30_000
_HEARTBEAT_INTERVAL_S = 10
_ROOM_SAFE_RE = re.compile(r"[.#$\[\]/]")


def is_configured(api_key: Optional[str], database_url: Optional[str]) -> bool:
    return bool(api_key and database_url)


def _safe_room(room: str) -> str:
    return _ROOM_SAFE_RE.sub("_", room)[:180]


class _TokenCache:
    def __init__(self, api_key: str):
        self._api_key = api_key
        self._token = None
        self._expires_at = 0.0
        self._lock = threading.Lock()

    def get(self) -> str:
        with self._lock:
            if self._token and self._expires_at > time.time() + 60:
                return self._token
            r = requests.post(
                _IDENTITY_TOOLKIT_URL,
                params={"key": self._api_key},
                json={"returnSecureToken": True},
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            token = data.get("idToken")
            if not token:
                raise RuntimeError("Firebase authentication returned no ID token")
            self._token = token
            self._expires_at = time.time() + float(data.get("expiresIn", 3600))
            return self._token


class FirebaseSignaling:
    """One call/control room. role is "child" (this device) or "parent"."""

    def __init__(
        self,
        api_key: str,
        database_url: str,
        room: str,
        role: str,
        on_signal: Callable[[str, dict], None],
        on_peer_online: Callable[[bool], None] = lambda online: None,
        on_error: Callable[[str], None] = lambda message: None,
    ):
        self._database_url = database_url.rstrip("/")
        self._tokens = _TokenCache(api_key)
        self._room = _safe_room(room)
        self._role = role
        self._peer_role = "parent" if role == "child" else "child"
        self._on_signal = on_signal
        self._on_peer_online = on_peer_online
        self._on_error = on_error

        self._signals_path = f"montoCalls/{self._room}/signals"
        self._my_presence_path = f"montoCalls/{self._room}/presence/{self._role}"
        self._peer_presence_path = f"montoCalls/{self._room}/presence/{self._peer_role}"

        self._started_at_ms = time.time() * 1000 - 2_000
        self._seen = set()
        self._closed = threading.Event()
        self._peer_last_seen_ms = 0.0
        self._threads = []

    # ── public API ──────────────────────────────────────────────────────────

    def start(self):
        self._heartbeat()  # first heartbeat synchronously, so presence is up before we return
        for target in (self._run_signal_stream, self._run_presence_stream, self._run_heartbeat_loop):
            t = threading.Thread(target=target, daemon=True)
            t.start()
            self._threads.append(t)

    def send(self, signal_type: str, payload: Optional[dict] = None):
        payload = payload or {}
        try:
            if signal_type == "ring":
                self._write(self._signals_path, "DELETE")
            self._write(
                self._signals_path,
                "POST",
                {"role": self._role, "type": signal_type, "payload": payload, "createdAt": time.time() * 1000},
            )
        except Exception as e:
            self._on_error(f"Firebase signal failed: {e}")

    def close(self):
        if self._closed.is_set():
            return
        self._closed.set()
        try:
            self._write(self._my_presence_path, "PUT", {"online": False, "lastSeen": time.time() * 1000})
        except Exception:
            pass

    # ── internals ───────────────────────────────────────────────────────────

    def _endpoint(self, path: str) -> str:
        token = self._tokens.get()
        return f"{self._database_url}/{path}.json?auth={token}"

    def _write(self, path: str, method: str, body: Optional[dict] = None):
        r = requests.request(method, self._endpoint(path), json=body, timeout=10)
        r.raise_for_status()

    def _heartbeat(self):
        self._write(self._my_presence_path, "PUT", {"online": True, "lastSeen": time.time() * 1000})

    def _run_heartbeat_loop(self):
        while not self._closed.is_set():
            time.sleep(_HEARTBEAT_INTERVAL_S)
            if self._closed.is_set():
                return
            try:
                self._heartbeat()
            except Exception:
                self._on_error("Firebase presence update failed")

    def _process_signal(self, key: str, signal: Optional[dict]):
        if not signal or key in self._seen or signal.get("role") == self._role:
            return
        self._seen.add(key)
        if (signal.get("createdAt") or 0) < self._started_at_ms:
            return
        self._on_signal(signal.get("type", ""), signal.get("payload") or {})

    def _run_signal_stream(self):
        self._sse_loop(self._signals_path, self._handle_signal_event)

    def _handle_signal_event(self, data: dict):
        path = data.get("path", "")
        payload = data.get("data")
        if path == "/" and isinstance(payload, dict):
            for key, value in payload.items():
                self._process_signal(key, value)
        elif path.startswith("/") and path.count("/") == 1:
            self._process_signal(path[1:], payload)

    def _run_presence_stream(self):
        self._sse_loop(self._peer_presence_path, self._handle_presence_event)

    def _handle_presence_event(self, data: dict):
        payload = data.get("data")
        if isinstance(payload, dict) and payload.get("online") and isinstance(payload.get("lastSeen"), (int, float)):
            self._peer_last_seen_ms = payload["lastSeen"]
            self._on_peer_online((time.time() * 1000 - self._peer_last_seen_ms) < _PRESENCE_STALE_MS)
        else:
            self._peer_last_seen_ms = 0
            self._on_peer_online(False)

    def _sse_loop(self, path: str, handle_event: Callable[[dict], None]):
        """Stream Firebase RTDB REST SSE events for `path`, reconnecting with
        backoff on drop — REST + SSE is what avoids pulling in the full
        Firebase client SDK, same tradeoff the TS version makes."""
        backoff = 1
        while not self._closed.is_set():
            try:
                resp = requests.get(
                    self._endpoint(path),
                    headers={"Accept": "text/event-stream"},
                    stream=True,
                    timeout=(10, None),
                )
                resp.raise_for_status()
                backoff = 1
                event_name = None
                for raw_line in resp.iter_lines(decode_unicode=True):
                    if self._closed.is_set():
                        break
                    if raw_line is None:
                        continue
                    line = raw_line.strip()
                    if not line:
                        event_name = None
                        continue
                    if line.startswith("event:"):
                        event_name = line[len("event:"):].strip()
                    elif line.startswith("data:"):
                        if event_name not in ("put", "patch"):
                            continue
                        raw_data = line[len("data:"):].strip()
                        try:
                            handle_event(json.loads(raw_data))
                        except Exception:
                            self._on_error("Invalid Firebase signaling event")
            except Exception:
                if self._closed.is_set():
                    return
                self._on_error("Firebase signaling reconnecting…")
                time.sleep(backoff)
                backoff = min(backoff * 2, 30)
