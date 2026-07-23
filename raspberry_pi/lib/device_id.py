"""
Persistent device id for this Pi — the native-kiosk counterpart to
frontend/lib/device-id.ts. Generated once and cached on disk (there's no
localStorage here), then reused as both the `child_device_id` for pairing
and the Firebase signaling room name.
"""
import os
import uuid

_ID_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".device_id")

_cached = None


def get_or_create_device_id() -> str:
    global _cached
    if _cached:
        return _cached

    path = os.path.abspath(_ID_FILE)
    if os.path.exists(path):
        with open(path, "r") as f:
            existing = f.read().strip()
        if existing:
            _cached = existing
            return _cached

    device_id = str(uuid.uuid4())
    with open(path, "w") as f:
        f.write(device_id)
    _cached = device_id
    return _cached
