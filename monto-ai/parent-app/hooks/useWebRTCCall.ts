"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CallStatus =
  | "idle"
  | "connecting-ws"
  | "ready"
  | "ringing"
  | "incoming"
  | "connecting"
  | "in-call"
  | "ended"
  | "error";

interface UseWebRTCCallOptions {
  role: "child" | "parent";
  signalingUrl: string;
  // Pairing/sync ID shared with the other side (see NEXT_PUBLIC_DEVICE_ID) —
  // isolates this family's calls when a backend hosts more than one pair.
  room?: string;
  // Overrides the env-derived default ICE servers — used when config comes
  // from a scanned pairing QR code instead of build-time env vars.
  iceServers?: RTCIceServer[];
  onIncomingCall?: () => void;
  onCallEnded?: () => void;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // TURN — required when child + parent are on different networks and a
  // direct peer-to-peer path can't be found (mobile data, symmetric NAT,
  // strict firewalls). Falls back to STUN-only if not configured.
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_PASSWORD,
        },
      ]
    : []),
];

export function useWebRTCCall({
  role,
  signalingUrl,
  room = "monto-room",
  iceServers,
  onIncomingCall,
  onCallEnded,
}: UseWebRTCCallOptions) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [peerOnline, setPeerOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([]);

  const updateStatus = useCallback((nextStatus: CallStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((value) => value + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const sendSignal = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const flushPendingIceCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;

    const candidates = pendingIceCandidates.current.splice(0);
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale candidates from an older negotiation.
      }
    }
  }, []);

  const cleanupPeer = useCallback(() => {
    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;
    pendingIceCandidates.current = [];

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    stopTimer();
  }, [stopTimer]);

  const createPeer = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: iceServers ?? DEFAULT_ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: "ice-candidate", candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (!remoteAudio.current || !event.streams[0]) return;

      remoteAudio.current.srcObject = event.streams[0];
      const playPromise = remoteAudio.current.play();
      if (playPromise) {
        playPromise.catch(() => {
          const unlockAudio = () => {
            remoteAudio.current?.play().catch(() => {});
            document.removeEventListener("click", unlockAudio);
            document.removeEventListener("touchstart", unlockAudio);
          };
          document.addEventListener("click", unlockAudio, { once: true });
          document.addEventListener("touchstart", unlockAudio, { once: true });
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        updateStatus("in-call");
        startTimer();
        return;
      }

      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        if (statusRef.current === "in-call" || statusRef.current === "connecting") {
          cleanupPeer();
          updateStatus("ended");
          onCallEnded?.();
          setTimeout(() => updateStatus("ready"), 2000);
        }
      }
    };

    return pc;
  }, [cleanupPeer, iceServers, onCallEnded, sendSignal, startTimer, updateStatus]);

  const getMic = useCallback(async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    localStream.current = stream;
    return stream;
  }, []);

  const handleMessage = useCallback(async (raw: string) => {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    const type = message.type as string;

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
        if (role === "child") {
          updateStatus("connecting");
          const stream = await getMic();
          const pc = createPeer();
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
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
        if (role === "parent") {
          updateStatus("connecting");
          const stream = await getMic();
          const pc = createPeer();
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          await pc.setRemoteDescription(new RTCSessionDescription(message.sdp as RTCSessionDescriptionInit));
          await flushPendingIceCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ type: "answer", sdp: answer });
        }
        break;

      case "answer":
        if (role === "child" && pcRef.current) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(message.sdp as RTCSessionDescriptionInit),
          );
          await flushPendingIceCandidates();
        }
        break;

      case "ice-candidate":
        if (message.candidate) {
          const candidate = message.candidate as RTCIceCandidateInit;
          if (!pcRef.current?.remoteDescription) {
            pendingIceCandidates.current.push(candidate);
            break;
          }

          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {
            // Ignore duplicate or stale ICE candidates.
          }
        }
        break;

      case "hangup":
        cleanupPeer();
        updateStatus("ended");
        onCallEnded?.();
        setTimeout(() => updateStatus("ready"), 2000);
        break;

      case "error":
        setError(message.message as string);
        updateStatus("error");
        setTimeout(() => {
          setError(null);
          updateStatus("ready");
        }, 4000);
        break;
    }
  }, [
    cleanupPeer,
    createPeer,
    flushPendingIceCandidates,
    getMic,
    onCallEnded,
    onIncomingCall,
    role,
    sendSignal,
    updateStatus,
  ]);

  const connect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setPeerOnline(false);
    updateStatus("connecting-ws");

    const url = new URL(signalingUrl);
    url.searchParams.set("role", role);
    url.searchParams.set("room", room);
    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    ws.onopen = () => updateStatus("ready");
    ws.onmessage = (event) => handleMessage(event.data);
    ws.onerror = () => updateStatus("error");
    ws.onclose = () => {
      if (statusRef.current !== "ended") {
        updateStatus("error");
        reconnectTimerRef.current = setTimeout(connect, 3000);
      }
    };
  }, [handleMessage, role, room, signalingUrl, updateStatus]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      cleanupPeer();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!remoteAudio.current) {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "true");
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
  }, [cleanupPeer, onCallEnded, sendSignal, updateStatus]);

  const toggleMute = useCallback(() => {
    localStream.current?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((muted) => !muted);
  }, []);

  const durationFormatted = `${Math.floor(duration / 60).toString().padStart(2, "0")}:${(duration % 60)
    .toString()
    .padStart(2, "0")}`;

  return {
    status,
    isMuted,
    duration,
    durationFormatted,
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
