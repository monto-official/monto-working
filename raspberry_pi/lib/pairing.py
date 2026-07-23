"""
Pairing client — talks to backend/routes/pairing.py, mirroring what
frontend/components/PairingQRModal.tsx does for the web child app.

Flow: this device mints a short-lived code via POST /pairing/code, shows it
as a QR ({v:2, code, api}); the parent app scans it and redeems it. From then
on GET /pairing/status/{device_id} tells us whether a parent is paired.
"""
import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)


def create_code(
    backend_url: str,
    device_id: str,
    api_url: str,
    turn_url: Optional[str] = None,
    turn_username: Optional[str] = None,
    turn_password: Optional[str] = None,
    timeout: float = 10,
) -> Optional[dict]:
    """Returns {"code": ..., "expires_at": ...} or None on failure."""
    try:
        r = requests.post(
            f"{backend_url}/pairing/code",
            json={
                "child_device_id": device_id,
                "api_url": api_url,
                "turn_url": turn_url,
                "turn_username": turn_username,
                "turn_password": turn_password,
            },
            timeout=timeout,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.error(f"[Pairing] create_code failed: {e}")
        return None


def get_status(backend_url: str, device_id: str, timeout: float = 10) -> Optional[list]:
    """Returns the list of paired parent devices, or None on failure."""
    try:
        r = requests.get(f"{backend_url}/pairing/status/{device_id}", timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.error(f"[Pairing] get_status failed: {e}")
        return None
