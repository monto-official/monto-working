"""
Call Route — /call
Provides endpoints to:
  - POST /call/ring-parent   → trigger the Monto box to call the parent (via AMI)
  - GET  /call/status        → check if parent SIP extension is registered
  - POST /call/hangup        → hang up an active call via AMI

These endpoints allow the Monto AI box (or backend logic) to programmatically
initiate a call to the parent using Asterisk's AMI (Asterisk Manager Interface).

Prerequisites:
  - Asterisk running with AMI enabled (manager.conf configured)
  - ASTERISK_HOST, ASTERISK_AMI_PORT, ASTERISK_AMI_USER, ASTERISK_AMI_SECRET
    set in backend/.env
"""
import asyncio
import logging
import os
import socket
import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/call", tags=["call"])

# ── AMI config from env ───────────────────────────────────────────────────────
ASTERISK_HOST      = os.getenv("ASTERISK_HOST",      "127.0.0.1")
ASTERISK_AMI_PORT  = int(os.getenv("ASTERISK_AMI_PORT",  "5038"))
ASTERISK_AMI_USER  = os.getenv("ASTERISK_AMI_USER",  "montoami")
ASTERISK_AMI_SECRET= os.getenv("ASTERISK_AMI_SECRET","montoamisecret")

# SIP extension names (must match sip.conf)
PARENT_EXTENSION = os.getenv("PARENT_EXTENSION", "parent")
MONTO_EXTENSION  = os.getenv("MONTO_EXTENSION",  "monto")
ASTERISK_CONTEXT = os.getenv("ASTERISK_CONTEXT", "monto-calls")


# ── Schemas ───────────────────────────────────────────────────────────────────

class RingParentRequest(BaseModel):
    """Optionally override caller ID shown on parent's phone."""
    caller_id: Optional[str] = "Monto Box <monto>"


class CallStatusResponse(BaseModel):
    parent_online: bool
    monto_online: bool
    message: str


# ── AMI helper ────────────────────────────────────────────────────────────────

class AsteriskAMI:
    """
    Minimal synchronous AMI client over raw TCP (telnet-compatible).
    Runs in a thread pool so FastAPI stays async.
    """

    def __init__(self):
        self.host   = ASTERISK_HOST
        self.port   = ASTERISK_AMI_PORT
        self.user   = ASTERISK_AMI_USER
        self.secret = ASTERISK_AMI_SECRET

    def _send_action(self, action_lines: list[str]) -> str:
        """
        Open a raw TCP connection to AMI, authenticate, send one action,
        read the response, and close. Uses socket instead of telnetlib
        (telnetlib was removed in Python 3.13).
        """
        CRLF = b"\r\n"
        try:
            sock = socket.create_connection((self.host, self.port), timeout=5)
        except OSError as exc:
            raise ConnectionError(f"Cannot connect to Asterisk AMI at {self.host}:{self.port}: {exc}")

        try:
            def recv_until(marker: bytes, timeout: float = 5.0) -> str:
                """Read from socket until marker is found or timeout."""
                buf = b""
                sock.settimeout(timeout)
                deadline = time.monotonic() + timeout
                while marker not in buf:
                    if time.monotonic() > deadline:
                        break
                    try:
                        chunk = sock.recv(4096)
                        if not chunk:
                            break
                        buf += chunk
                    except socket.timeout:
                        break
                return buf.decode(errors="ignore")

            # Read the Asterisk banner line
            recv_until(b"\r\n", timeout=3)

            # Login
            login_msg = (
                f"Action: Login\r\n"
                f"Username: {self.user}\r\n"
                f"Secret: {self.secret}\r\n"
                f"\r\n"
            )
            sock.sendall(login_msg.encode())
            resp = recv_until(b"\r\n\r\n", timeout=3)
            if "Success" not in resp and "Authentication accepted" not in resp:
                raise ConnectionError(f"AMI login failed: {resp!r}")

            # Send the action
            payload = "\r\n".join(action_lines) + "\r\n\r\n"
            sock.sendall(payload.encode())

            # Read response
            result = recv_until(b"\r\n\r\n", timeout=5)

            # Logout
            try:
                sock.sendall(b"Action: Logoff\r\n\r\n")
            except OSError:
                pass

            return result
        finally:
            try:
                sock.close()
            except OSError:
                pass

    async def originate(
        self,
        channel: str,
        extension: str,
        context: str,
        caller_id: str,
    ) -> str:
        """
        AMI Originate — initiates an outbound call.
        channel   = "SIP/monto"       (which SIP peer dials)
        extension = "parent"          (what they dial)
        context   = "monto-calls"
        """
        action = [
            "Action: Originate",
            f"Channel: SIP/{channel}",
            f"Exten: {extension}",
            f"Context: {context}",
            "Priority: 1",
            f"CallerID: {caller_id}",
            "Timeout: 30000",
            "Async: true",
        ]
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._send_action, action)
        return result

    async def sip_show_peer(self, peer: str) -> bool:
        """
        Check if a SIP peer is registered (returns True if Status contains 'OK').
        """
        action = [
            "Action: SIPshowpeer",
            f"Peer: {peer}",
        ]
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._send_action, action)
            return "Status: OK" in result or "REGISTERED" in result.upper()
        except Exception:
            return False


_ami = AsteriskAMI()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/ring-parent")
async def ring_parent(req: RingParentRequest):
    """
    Instruct the Monto AI box to call the parent.
    Uses Asterisk AMI Originate: opens a call leg on the Monto box extension,
    then connects it to the parent extension.
    """
    logger.info(f"[Call] Requesting Monto box to ring parent — CallerID: {req.caller_id}")
    try:
        result = await _ami.originate(
            channel   = MONTO_EXTENSION,
            extension = PARENT_EXTENSION,
            context   = ASTERISK_CONTEXT,
            caller_id = req.caller_id or f"Monto Box <{MONTO_EXTENSION}>",
        )
        if "Response: Error" in result:
            raise HTTPException(
                status_code=502,
                detail=f"AMI Originate failed: {result}",
            )
        logger.info(f"[Call] AMI response: {result[:120]}")
        return {"status": "ringing", "message": "Monto is calling the parent app"}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[Call] ring-parent error: {exc}")
        raise HTTPException(status_code=503, detail=f"Asterisk AMI unreachable: {exc}")


@router.get("/status", response_model=CallStatusResponse)
async def call_status():
    """
    Check whether both SIP peers (parent + monto) are currently registered.
    """
    parent_online, monto_online = await asyncio.gather(
        _ami.sip_show_peer(PARENT_EXTENSION),
        _ami.sip_show_peer(MONTO_EXTENSION),
    )

    msg_parts = []
    if not parent_online:
        msg_parts.append("Parent app not connected — open the parent app and wait for 'Ready'.")
    if not monto_online:
        msg_parts.append("Monto box not connected — check the Pi SIP client.")

    return CallStatusResponse(
        parent_online = parent_online,
        monto_online  = monto_online,
        message       = " ".join(msg_parts) if msg_parts else "Both peers online.",
    )
