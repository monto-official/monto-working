"""
Native voice-call peer for the Pi kiosk — the aiortc counterpart to
frontend/hooks/useWebRTCCall.ts. Browsers have no Python equivalent, so this
is a real (if smaller) WebRTC implementation: it speaks the exact same
Firebase signaling messages (ring/accept/reject/offer/answer/ice-candidate/
hangup) so the parent app doesn't need to know whether it's calling the web
child app or this native kiosk.

Runs on its own dedicated asyncio event loop (owned by a background thread),
since the rest of monto_listener.py is a blocking pygame loop + plain
threads and aiortc requires asyncio.
"""
import asyncio
import fractions
import logging
import threading
import time
from typing import Callable, Optional

import numpy as np
import pyaudio
from aiortc import RTCConfiguration, RTCIceServer, RTCPeerConnection, RTCSessionDescription
from aiortc.mediastreams import MediaStreamError, MediaStreamTrack
from av import AudioFrame

from lib.firebase_signaling import FirebaseSignaling, is_configured

logger = logging.getLogger(__name__)

SAMPLE_RATE = 48000
FRAME_MS = 20
FRAME_SAMPLES = SAMPLE_RATE * FRAME_MS // 1000
NO_ANSWER_TIMEOUT_S = 120
DISCONNECT_GRACE_S = 15


def _resample_int16(samples: np.ndarray, from_rate: int, to_rate: int) -> np.ndarray:
    if from_rate == to_rate or len(samples) == 0:
        return samples
    duration = len(samples) / from_rate
    target_len = max(1, int(round(duration * to_rate)))
    src_x = np.linspace(0, 1, num=len(samples), endpoint=False)
    dst_x = np.linspace(0, 1, num=target_len, endpoint=False)
    return np.interp(dst_x, src_x, samples).astype(np.int16)


class MicAudioTrack(MediaStreamTrack):
    """Reads live PCM from a continuously-open PyAudio input stream and
    yields WebRTC audio frames — the native equivalent of the browser's
    `getUserMedia()` local track."""

    kind = "audio"

    def __init__(self, mic_index: Optional[int], mic_rate: int):
        super().__init__()
        self._mic_rate = mic_rate
        self._pa = pyaudio.PyAudio()
        kwargs = dict(
            format=pyaudio.paInt16, channels=1, rate=mic_rate, input=True,
            frames_per_buffer=int(mic_rate * FRAME_MS / 1000),
        )
        if mic_index is not None:
            kwargs["input_device_index"] = mic_index
        self._stream = self._pa.open(**kwargs)
        self._read_size = int(mic_rate * FRAME_MS / 1000)
        self._timestamp = 0

    async def recv(self) -> AudioFrame:
        if self.readyState != "live":
            raise MediaStreamError

        # PyAudio's stream.read() blocks on real hardware I/O — run it off
        # the event loop thread so other coroutines (signaling, playback)
        # keep making progress while we wait for the next ~20ms of audio.
        raw = await asyncio.get_event_loop().run_in_executor(
            None, self._stream.read, self._read_size, False,
        )
        samples = np.frombuffer(raw, dtype=np.int16)
        samples = _resample_int16(samples, self._mic_rate, SAMPLE_RATE)

        frame = AudioFrame(format="s16", layout="mono", samples=len(samples))
        frame.planes[0].update(samples.tobytes())
        frame.sample_rate = SAMPLE_RATE
        frame.pts = self._timestamp
        frame.time_base = fractions.Fraction(1, SAMPLE_RATE)
        self._timestamp += len(samples)
        return frame

    def stop(self):
        super().stop()
        try:
            self._stream.stop_stream()
            self._stream.close()
            self._pa.terminate()
        except Exception:
            pass


class RemoteAudioPlayer:
    """Persistent PyAudio output stream fed by the peer's incoming track —
    the native equivalent of the browser's <audio> element in useWebRTCCall."""

    def __init__(self):
        self._pa = pyaudio.PyAudio()
        self._stream = self._pa.open(format=pyaudio.paInt16, channels=1, rate=SAMPLE_RATE, output=True)
        self._task: Optional[asyncio.Task] = None

    def start(self, track: MediaStreamTrack):
        self._task = asyncio.ensure_future(self._run(track))

    async def _run(self, track: MediaStreamTrack):
        try:
            while True:
                frame = await track.recv()
                pcm = frame.to_ndarray().astype(np.int16).tobytes()
                await asyncio.get_event_loop().run_in_executor(None, self._stream.write, pcm)
        except MediaStreamError:
            pass
        except Exception as e:
            logger.error(f"[Call] remote audio playback error: {e}")

    def stop(self):
        if self._task:
            self._task.cancel()
        try:
            self._stream.stop_stream()
            self._stream.close()
            self._pa.terminate()
        except Exception:
            pass


class CallManager:
    """State machine mirroring useWebRTCCall.ts, role is always "child" here."""

    def __init__(
        self,
        room: str,
        firebase_api_key: str,
        firebase_database_url: str,
        get_mic_source: Callable[[], "tuple[Optional[int], int]"],
        turn_url: Optional[str] = None,
        turn_username: Optional[str] = None,
        turn_password: Optional[str] = None,
        on_incoming_call: Callable[[], None] = lambda: None,
        on_call_started: Callable[[], None] = lambda: None,
        on_call_ended: Callable[[], None] = lambda: None,
    ):
        self._room = room
        self._get_mic_source = get_mic_source
        self._turn_url = turn_url
        self._turn_username = turn_username
        self._turn_password = turn_password
        self._on_incoming_call = on_incoming_call
        self._on_call_started = on_call_started
        self._on_call_ended = on_call_ended

        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._signaling: Optional[FirebaseSignaling] = None
        self._pc: Optional[RTCPeerConnection] = None
        self._local_track: Optional[MicAudioTrack] = None
        self._remote_player: Optional[RemoteAudioPlayer] = None
        self._status = "idle"
        self._no_answer_timer: Optional[asyncio.TimerHandle] = None

        if not is_configured(firebase_api_key, firebase_database_url):
            logger.warning("[Call] Firebase not configured — voice calling disabled")
            self._configured = False
            return
        self._configured = True
        self._firebase_api_key = firebase_api_key
        self._firebase_database_url = firebase_database_url

    # ── lifecycle ───────────────────────────────────────────────────────────

    def start(self):
        if not self._configured:
            return
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        self._signaling = FirebaseSignaling(
            api_key=self._firebase_api_key,
            database_url=self._firebase_database_url,
            room=self._room,
            role="child",
            on_signal=self._on_signal_threadsafe,
            on_peer_online=lambda online: None,
            on_error=lambda msg: logger.warning(f"[Call] {msg}"),
        )
        self._signaling.start()
        self._loop.run_forever()

    def _on_signal_threadsafe(self, signal_type: str, payload: dict):
        if self._loop:
            asyncio.run_coroutine_threadsafe(self._handle_signal(signal_type, payload), self._loop)

    # ── user-facing actions (safe to call from the pygame thread) ───────────

    def accept_call(self):
        self._schedule(self._do_accept())

    def reject_call(self):
        self._schedule(self._do_reject())

    def hang_up(self):
        self._schedule(self._do_hangup())

    def _schedule(self, coro):
        if self._loop:
            asyncio.run_coroutine_threadsafe(coro, self._loop)

    # ── ICE config ────────────────────────────────────────────────────────

    def _ice_config(self) -> RTCConfiguration:
        servers = [
            RTCIceServer(urls="stun:stun.l.google.com:19302"),
            RTCIceServer(urls="stun:stun1.l.google.com:19302"),
        ]
        if self._turn_url:
            servers.append(RTCIceServer(urls=self._turn_url, username=self._turn_username, credential=self._turn_password))
        return RTCConfiguration(iceServers=servers)

    def _create_peer(self) -> RTCPeerConnection:
        pc = RTCPeerConnection(configuration=self._ice_config())
        self._pc = pc

        @pc.on("track")
        def on_track(track):
            self._remote_player = RemoteAudioPlayer()
            self._remote_player.start(track)

        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"[Call] connection state: {pc.connectionState}")
            if pc.connectionState == "connected":
                self._status = "in-call"
                self._on_call_started()
            elif pc.connectionState in ("failed", "closed"):
                await self._do_hangup(notify_peer=False)

        return pc

    async def _add_local_track(self, pc: RTCPeerConnection):
        mic_index, mic_rate = self._get_mic_source()
        self._local_track = MicAudioTrack(mic_index, mic_rate)
        pc.addTrack(self._local_track)

    # ── signal handling — mirrors handleSignal in useWebRTCCall.ts ─────────

    async def _handle_signal(self, signal_type: str, payload: dict):
        try:
            if signal_type == "ring":
                self._status = "incoming"
                self._on_incoming_call()

            elif signal_type == "accept":
                # We rang out; the parent accepted — send our offer.
                self._status = "connecting"
                pc = self._create_peer()
                await self._add_local_track(pc)
                offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                self._signaling.send("offer", {"sdp": {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}})

            elif signal_type == "offer":
                # Parent is calling us — we already sent "accept".
                self._status = "connecting"
                pc = self._create_peer()
                await self._add_local_track(pc)
                sdp = payload.get("sdp", {})
                await pc.setRemoteDescription(RTCSessionDescription(sdp=sdp.get("sdp"), type=sdp.get("type")))
                answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                self._signaling.send("answer", {"sdp": {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}})

            elif signal_type == "answer":
                if self._pc:
                    sdp = payload.get("sdp", {})
                    await self._pc.setRemoteDescription(RTCSessionDescription(sdp=sdp.get("sdp"), type=sdp.get("type")))

            elif signal_type == "ice-candidate":
                # aiortc waits for full ICE gathering before setLocalDescription
                # returns, so we never send our own trickled candidates — but
                # the browser side does, so we still need to consume theirs.
                candidate = payload.get("candidate")
                if candidate and self._pc:
                    await self._apply_remote_candidate(candidate)

            elif signal_type == "reject":
                await self._do_hangup(notify_peer=False)

            elif signal_type == "hangup":
                await self._do_hangup(notify_peer=False)
        except Exception as e:
            logger.error(f"[Call] signal handling error ({signal_type}): {e}")
            await self._do_hangup(notify_peer=False)

    async def _apply_remote_candidate(self, candidate: dict):
        from aiortc.sdp import candidate_from_sdp

        try:
            ice = candidate_from_sdp(candidate["candidate"].split(":", 1)[1])
            ice.sdpMid = candidate.get("sdpMid")
            ice.sdpMLineIndex = candidate.get("sdpMLineIndex")
            await self._pc.addIceCandidate(ice)
        except Exception as e:
            logger.warning(f"[Call] ignoring ICE candidate: {e}")

    # ── outbound actions ─────────────────────────────────────────────────

    async def _do_accept(self):
        if self._status != "incoming":
            return
        self._status = "connecting"
        self._signaling.send("accept")

    async def _do_reject(self):
        self._signaling.send("reject")
        await self._cleanup()

    async def _do_hangup(self, notify_peer: bool = True):
        if notify_peer and self._signaling:
            self._signaling.send("hangup")
        await self._cleanup()
        self._on_call_ended()

    async def _cleanup(self):
        self._status = "idle"
        if self._local_track:
            self._local_track.stop()
            self._local_track = None
        if self._remote_player:
            self._remote_player.stop()
            self._remote_player = None
        if self._pc:
            await self._pc.close()
            self._pc = None

    def close(self):
        if self._signaling:
            self._signaling.close()
        if self._loop:
            self._loop.call_soon_threadsafe(self._loop.stop)
