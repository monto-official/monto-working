"use client";
/**
 * useWebRTCCall — WebRTC peer-to-peer audio call via backend signaling
 *
 * role="child"  → child app (initiates calls)
 * role="parent" → parent app (receives calls)
 *
 * Flow:
 *   child: ring → offer → [ICE] ←→ [ICE] → answer → in-call
 *   parent: ring notification → accept → answer → in-call
 */
import { useEffect, useRef, useCallback, useState } from "react";

export type CallStatus =
  | "idle"
  | "connecting-ws"
  | "ready"
  | "ringing"       // child sent ring, waiting for parent to accept
  | "incoming"      // parent received ring
  | "connecting"    // WebRTC negotiating
  | "in-call"
  | "ended"
  | "error";

interface UseWebRTCCallOptions {
  role: "child" | "parent";
  signalingUrl: string;    // ws://host:8000/ws/call?role=child
  onIncomingCall?: () => void;
  onCallEnded?: () => void;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function useWebRTCCall({
  role,
  signalingUrl,
  onIncomingCall,
  onCallEnded,
}: UseWebRTCCallOptions) {
  const [status, setStatus]     = useState<CallStatus>("idle");
  const [isMuted, setIsMuted]   = useState(false);
  const [duration, setDuration] = useState(0);
  const [peerOnline, setPeerOnline] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const wsRef       = useRef<WebSocket | null>(null);
  const pcRef       = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef   = useRef<CallStatus>("idle");

  const updateStatus = useCallback((s: CallStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  // ── Start call duration timer ────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Cleanup WebRTC resources ─────────────────────────────────────────────
  const cleanupPeer = useCallback(() => {
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    stopTimer();
  }, [stopTimer]);

  // ── Send message via signaling WS ────────────────────────────────────────
  const sendSignal = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // ── Create RTCPeerConnection ─────────────────────────────────────────────
  const createPeer = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal({ type: "ice-candidate", candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteAudio.current && e.streams[0]) {
        remoteAudio.current.srcObject = e.streams[0];
        // Resume AudioContext if suspended (browser autoplay policy)
        const playPromise = remoteAudio.current.play();
        if (playPromise) {
          playPromise.catch(() => {
            // Retry on next user interaction
            const unlock = () => {
              remoteAudio.current?.play().catch(() => {});
              document.removeEventListener("click", unlock);
              document.removeEventListener("touchstart", unlock);
            };
            document.addEventListener("click", unlock, { once: true });
            document.addEventListener("touchstart", unlock, { once: true });
          });
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        updateStatus("in-call");
        startTimer();
      } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        if (statusRef.current === "in-call" || statusRef.current === "connecting") {
          cleanupPeer();
          updateStatus("ended");
          onCallEnded?.();
          setTimeout(() => updateStatus("ready"), 2000);
        }
      }
    };

    return pc;
  }, [sendSignal, updateStatus, startTimer, cleanupPeer, onCallEnded]);

  // ── Get mic stream ────────────────────────────────────────────────────────
  const getMic = useCallback(async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    localStream.current = stream;
    return stream;
  }, []);

  // ── Handle incoming signaling messages ───────────────────────────────────
  const handleMessage = useCallback(async (raw: string) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(raw); } catch { return; }

    const type = msg.type as string;

    switch (type) {
      case "peer-online":
        setPeerOnline(true);
        break;

      case "peer-offline":
        setPeerOnline(false);
        if (statusRef.current === "ringing" || statusRef.current === "in-call") {
          cleanupPeer();
          updateStatus("ended");
          onCallEnded?.();
          setTimeout(() => updateStatus("ready"), 2000);
        }
        break;

      case "ring":
        if (role === "parent") {
          updateStatus("incoming");
          onIncomingCall?.();
        }
        break;

      case "accept":
        // Parent accepted — child creates and sends offer
        if (role === "child") {
          updateStatus("connecting");
          const stream = await getMic();
          const pc = createPeer();
          stream.getTracks().forEach(t => pc.addTrack(t, stream));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal({ type: "offer", sdp: offer });
        }
        break;

      case "reject":
        if (role === "child") {
          cleanupPeer();
          updateStatus("ended");
          setTimeout(() => updateStatus("ready"), 2000);
        }
        break;

      case "offer":
        // Parent receives offer → answer
        if (role === "parent") {
          updateStatus("connecting");
          const stream = await getMic();
          const pc = createPeer();
          stream.getTracks().forEach(t => pc.addTrack(t, stream));
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ type: "answer", sdp: answer });
        }
        break;

      case "answer":
        // Child receives answer
        if (role === "child" && pcRef.current) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit)
          );
        }
        break;

      case "ice-candidate":
        if (pcRef.current && msg.candidate) {
          try {
            await pcRef.current.addIceCandidate(
              new RTCIceCandidate(msg.candidate as RTCIceCandidateInit)
            );
          } catch { /* ignore */ }
        }
        break;

      case "hangup":
        cleanupPeer();
        updateStatus("ended");
        onCallEnded?.();
        setTimeout(() => updateStatus("ready"), 2000);
        break;

      case "error":
        setError(msg.message as string);
        updateStatus("error");
        setTimeout(() => { setError(null); updateStatus("ready"); }, 4000);
        break;
    }
  }, [role, getMic, createPeer, sendSignal, updateStatus, cleanupPeer, onIncomingCall, onCallEnded]);

  // ── Connect to signaling server ──────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    updateStatus("connecting-ws");
    const ws = new WebSocket(`${signalingUrl}?role=${role}`);
    wsRef.current = ws;

    ws.onopen = () => {
      updateStatus("ready");
      console.log(`[WebRTC] Connected to signaling as ${role}`);
    };
    ws.onmessage = (e) => handleMessage(e.data);
    ws.onerror   = () => updateStatus("error");
    ws.onclose   = () => {
      if (statusRef.current !== "ended") {
        updateStatus("error");
        // Reconnect after 3s
        setTimeout(connect, 3000);
      }
    };
  }, [signalingUrl, role, updateStatus, handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      cleanupPeer();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create & attach remote audio element to DOM ─────────────────────────
  useEffect(() => {
    if (!remoteAudio.current) {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.style.display = "none";
      document.body.appendChild(audio);
      remoteAudio.current = audio;
    }
    return () => {
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = null;
        remoteAudio.current.remove();
        remoteAudio.current = null;
      }
    };
  }, []);

  // ── Public actions ────────────────────────────────────────────────────────

  const ringParent = useCallback(() => {
    if (statusRef.current !== "ready") return;
    updateStatus("ringing");
    sendSignal({ type: "ring" });
  }, [sendSignal, updateStatus]);

  const acceptCall = useCallback(() => {
    if (statusRef.current !== "incoming") return;
    updateStatus("connecting");
    sendSignal({ type: "accept" });
  }, [sendSignal, updateStatus]);

  const rejectCall = useCallback(() => {
    sendSignal({ type: "reject" });
    updateStatus("ready");
  }, [sendSignal, updateStatus]);

  const hangUp = useCallback(() => {
    sendSignal({ type: "hangup" });
    cleanupPeer();
    updateStatus("ended");
    onCallEnded?.();
    setTimeout(() => updateStatus("ready"), 1500);
  }, [sendSignal, cleanupPeer, updateStatus, onCallEnded]);

  const toggleMute = useCallback(() => {
    localStream.current?.getAudioTracks().forEach(t => {
      t.enabled = !t.enabled;
    });
    setIsMuted(m => !m);
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return {
    status,
    isMuted,
    duration,
    durationFormatted: formatDuration(duration),
    peerOnline,
    error,
    remoteAudioRef: remoteAudio,
    ringParent,
    acceptCall,
    rejectCall,
    hangUp,
    toggleMute,
  };
}
