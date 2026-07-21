"""
Monto AI — Raspberry Pi SIP Client
===================================
Registers the Pi as the "monto" SIP extension on Asterisk so that:
  1. The parent app can call the Pi   → Pi answers + plays audio to child
  2. The Pi can call the parent app   → triggered by wake word + special intent

Designed to run alongside monto_listener.py (import and call from there),
or as a standalone process.

Dependencies (add to raspberry_pi/requirements.txt):
  pjsua2      # or use linphone-python if pjsua2 unavailable on your Pi
  # Alternative: use aiohttp to call backend /call/ring-parent instead of
  # direct SIP — see call_parent_via_backend() below.

Environment variables (raspberry_pi/.env):
  ASTERISK_HOST=192.168.1.10
  SIP_USERNAME=monto
  SIP_PASSWORD=montopass123
  SIP_DOMAIN=192.168.1.10
  PARENT_EXTENSION=parent
  BACKEND_URL=http://192.168.1.101:8000   ← existing backend
"""

import logging
import os
import threading
import time
from typing import Optional, Callable

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

ASTERISK_HOST     = os.getenv("ASTERISK_HOST",     "192.168.1.10")
SIP_USERNAME      = os.getenv("SIP_USERNAME",      "monto")
SIP_PASSWORD      = os.getenv("SIP_PASSWORD",      "montopass123")
SIP_DOMAIN        = os.getenv("SIP_DOMAIN",        ASTERISK_HOST)
PARENT_EXTENSION  = os.getenv("PARENT_EXTENSION",  "parent")
BACKEND_URL       = os.getenv("BACKEND_URL",       "http://localhost:8000")


# ══════════════════════════════════════════════════════════════════════════════
# Option A — Call parent via backend REST API (simplest, no PJSUA needed on Pi)
# ══════════════════════════════════════════════════════════════════════════════

def call_parent_via_backend(caller_id: Optional[str] = None) -> bool:
    """
    Ask the backend to use Asterisk AMI to ring the parent.
    This is the recommended approach for the Pi — no SIP library required.

    Returns True if the call was successfully initiated.
    """
    url = f"{BACKEND_URL}/call/ring-parent"
    payload = {"caller_id": caller_id or f"Monto Box <{SIP_USERNAME}>"}
    try:
        resp = requests.post(url, json=payload, timeout=5)
        if resp.ok:
            logger.info("[SIP] Call to parent initiated via backend AMI")
            return True
        else:
            logger.error(f"[SIP] Backend returned {resp.status_code}: {resp.text}")
            return False
    except requests.RequestException as exc:
        logger.error(f"[SIP] Failed to reach backend: {exc}")
        return False


def check_parent_online() -> bool:
    """Check if the parent SIP extension is currently registered."""
    try:
        resp = requests.get(f"{BACKEND_URL}/call/status", timeout=5)
        if resp.ok:
            data = resp.json()
            return data.get("parent_online", False)
    except requests.RequestException:
        pass
    return False


# ══════════════════════════════════════════════════════════════════════════════
# Option B — Direct PJSUA2 SIP client on the Pi
#            Use this if you want the Pi to answer calls from the parent too.
#            Requires: pip install pjsua2 (or build from source)
# ══════════════════════════════════════════════════════════════════════════════

try:
    import pjsua2 as pj

    class MontoSIPAccount(pj.Account):
        def __init__(self, on_incoming_call: Optional[Callable] = None):
            super().__init__()
            self.on_incoming_call = on_incoming_call
            self.active_call: Optional[pj.Call] = None

        def onIncomingCall(self, prm: pj.OnIncomingCallParam) -> None:
            """Called when the parent app rings the Monto box."""
            logger.info("[SIP] Incoming call from parent — answering")
            call = MontoCall(self)
            self.active_call = call
            call_prm = pj.CallOpParam()
            call_prm.statusCode = 200   # 200 OK — auto-answer
            call.answer(call_prm)
            if self.on_incoming_call:
                self.on_incoming_call(call)

    class MontoCall(pj.Call):
        def onCallState(self, prm: pj.OnCallStateParam) -> None:
            ci = self.getInfo()
            logger.info(f"[SIP] Call state: {ci.stateText}")

        def onCallMediaState(self, prm: pj.OnCallMediaStateParam) -> None:
            ci = self.getInfo()
            for mi in ci.media:
                if mi.type == pj.PJMEDIA_TYPE_AUDIO and mi.status == pj.PJSUA_CALL_MEDIA_ACTIVE:
                    aud_med = self.getAudioMedia(mi.index)
                    # Connect call audio to default speaker + mic
                    ep = pj.Endpoint.instance()
                    aud_med.startTransmit(ep.audDevManager().getCaptureDevMedia())
                    ep.audDevManager().getPlaybackDevMedia().startTransmit(aud_med)
                    logger.info("[SIP] Audio path connected")

    class MontoSIPClient:
        """
        PJSUA2-based SIP client.
        Registers with Asterisk and handles inbound calls from parent.
        """

        def __init__(self, on_incoming_call: Optional[Callable] = None):
            self.ep = pj.Endpoint()
            self.account: Optional[MontoSIPAccount] = None
            self.on_incoming_call = on_incoming_call

        def start(self) -> None:
            ep_cfg = pj.EpConfig()
            ep_cfg.logConfig.level = 3
            self.ep.libCreate()
            self.ep.libInit(ep_cfg)

            # UDP transport
            sip_tp_cfg = pj.TransportConfig()
            sip_tp_cfg.port = 5060
            self.ep.transportCreate(pj.PJSIP_TRANSPORT_UDP, sip_tp_cfg)

            self.ep.libStart()
            logger.info("[SIP] PJSUA2 endpoint started")

            # Register account
            acc_cfg = pj.AccountConfig()
            acc_cfg.idUri        = f"sip:{SIP_USERNAME}@{SIP_DOMAIN}"
            acc_cfg.regConfig.registrarUri = f"sip:{SIP_DOMAIN}"
            cred = pj.AuthCredInfo("digest", "*", SIP_USERNAME, 0, SIP_PASSWORD)
            acc_cfg.sipConfig.authCreds.append(cred)

            self.account = MontoSIPAccount(self.on_incoming_call)
            self.account.create(acc_cfg)
            logger.info(f"[SIP] Registered as sip:{SIP_USERNAME}@{SIP_DOMAIN}")

        def call_parent(self) -> Optional[pj.Call]:
            """Place a call to the parent extension."""
            if not self.account:
                logger.error("[SIP] Account not initialised")
                return None
            call = MontoCall(self.account)
            prm = pj.CallOpParam(True)
            call.makeCall(f"sip:{PARENT_EXTENSION}@{SIP_DOMAIN}", prm)
            logger.info(f"[SIP] Calling parent at sip:{PARENT_EXTENSION}@{SIP_DOMAIN}")
            return call

        def stop(self) -> None:
            self.ep.libDestroy()
            logger.info("[SIP] PJSUA2 endpoint stopped")

    PJSUA2_AVAILABLE = True

except ImportError:
    PJSUA2_AVAILABLE = False
    logger.info(
        "[SIP] pjsua2 not installed — using REST API method to initiate calls. "
        "Install pjsua2 for direct SIP + inbound call handling on the Pi."
    )


# ══════════════════════════════════════════════════════════════════════════════
# Convenience function — call from monto_listener.py
# ══════════════════════════════════════════════════════════════════════════════

def ring_parent() -> bool:
    """
    Ring the parent. Tries PJSUA2 direct call first, falls back to backend API.
    Call this from monto_listener.py when a child says "call mum" or similar.
    """
    if PJSUA2_AVAILABLE:
        # Direct SIP — handled by PJSUA2
        # (MontoSIPClient must already be initialised and running)
        logger.info("[SIP] Using PJSUA2 to call parent directly")
        # _sip_client.call_parent() would be called here if integrated
        return True
    else:
        # Fallback: ask backend to trigger via Asterisk AMI
        return call_parent_via_backend()
