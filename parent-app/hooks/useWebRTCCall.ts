"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createFirebaseSignaling, isFirebaseSignalingConfigured, type FirebaseSignalingChannel } from "@/lib/firebase-signaling";

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
  // Plain http(s) backend base URL â€” signaling is HTTP polling now, not a
  // persistent WebSocket (see routes/call_signal.py). Only the parent/child
  // control channel (music/pairing notifications) still uses a WebSocket.
  apiUrl: string;
  // Pairing/sync ID shared with the other side â€” isolates this family's
  // calls when a backend hosts more than one pair.
  room?: string;
  iceServers?: RTCIceServer[];
  onIncomingCall?: () => void;
  onCallEnded?: () => void;
}

const HAS_TURN = !!process.env.NEXT_PUBLIC_TURN_URL;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // TURN â€” required when child + parent are on different networks and a
  // direct peer-to-peer path can't be found (mobile data, symmetric NAT,
  // strict firewalls, AP/client isolation). Falls back to STUN-only if not
  // configured.
  ...(HAS_TURN
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL!,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_PASSWORD,
        },
      ]
    : []),
];

// Durable backend polling is used for call negotiation and history. Firebase remains
// available to the always-on control channel that wakes either app.
const USE_FIREBASE_FOR_CALL_SIGNALING = false;
const POLL_INTERVAL_MS = 1000;

// Best-effort diagnostic beacon to the backend's /debug/log sink â€” the only
// way to see what's actually happening on a phone without plugging it into
// devtools. Fire-and-forget; never blocks or throws into the caller.
function debugBeacon(apiUrl: string, data: object) {
  try {
    fetch(`${apiUrl}/debug/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export function useWebRTCCall({
  role,
  apiUrl,
  room = "monto-room",
  iceServers,
  onIncomingCall,
  onCallEnded,
}: UseWebRTCCallOptions) {
  const resolvedIceServers = iceServers ?? ICE_SERVERS;
  const hasTurn = resolvedIceServers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => url.startsWith("turn:" ) || url.startsWith("turns:"));
  });
  const [status, setStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [peerOnline, setPeerOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([]);

  const lastIdRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const peerOnlineRef = useRef(false);
  const pollFailuresRef = useRef(0);
  const firebaseChannelRef = useRef<FirebaseSignalingChannel | null>(null);
  const POLL_FAILURE_THRESHOLD = 4;

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

  // Firebase RTDB is primary; HTTP is retained when Firebase isn't configured.
  const sendSignal = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (firebaseChannelRef.current) {
      void firebaseChannelRef.current.send(type, payload).catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Firebase signal failed");
        updateStatus("error");
      });
      return;
    }
    fetch(`${apiUrl}/call/${room}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, type, payload }),
    }).catch(() => {});
  }, [apiUrl, room, role, updateStatus]);
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
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
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
    const pc = new RTCPeerConnection({
      iceServers: resolvedIceServers,
      // When a TURN server is configured, skip host/srflx candidates
      // entirely and go straight through the relay â€” on a network with
      // AP/client isolation, direct P2P candidates would only ever fail.
      iceTransportPolicy: "all",
    });
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ice-candidate", { candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      debugBeacon(apiUrl, { role, room, event: "ice-state", iceConnectionState: pc.iceConnectionState });
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
      debugBeacon(apiUrl, { role, room, event: "connection-state", connectionState: pc.connectionState });

      if (pc.connectionState === "connected") {
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        updateStatus("in-call");
        startTimer();
        return;
      }

      if (pc.connectionState === "disconnected") {
        if (!disconnectTimerRef.current) {
          disconnectTimerRef.current = setTimeout(() => {
            disconnectTimerRef.current = null;
            if (pc.connectionState !== "disconnected" || pcRef.current !== pc) return;
            updateStatus("ended");
            cleanupPeer();
            onCallEnded?.();
            setTimeout(() => updateStatus("ready"), 2000);
          }, 15000);
        }
        return;
      }

      if (pc.connectionState === "failed" &&
          (statusRef.current === "in-call" || statusRef.current === "connecting")) {
        updateStatus("ended");
        cleanupPeer();
        onCallEnded?.();
        setTimeout(() => updateStatus("ready"), 2000);
      }
    };

    return pc;
  }, [cleanupPeer, resolvedIceServers, hasTurn, onCallEnded, sendSignal, startTimer, updateStatus, apiUrl, role, room]);

  const getMic = useCallback(async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    localStream.current = stream;
    return stream;
  }, []);

  const handleSignal = useCallback(async (type: string, payload: Record<string, unknown>) => {
    switch (type) {
      case "ring":
        // Only ever polled by whichever side didn't send it, so this fires
        // for the parent when the child calls out, and for the child when
        // the parent calls in.
        updateStatus("incoming");
        onIncomingCall?.();
        break;

      case "accept":
        // Only ever seen by whoever sent the original "ring" (the caller) â€”
        // the callee that just accepted is waiting for this side's offer.
        updateStatus("connecting");
        {
          if (pcRef.current) cleanupPeer();
          const stream = await getMic();
          const pc = createPeer();
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal("offer", { sdp: offer });
        }
        break;

      case "reject":
        cleanupPeer();
        updateStatus("ended");
        setTimeout(() => updateStatus("ready"), 2000);
        break;

      case "offer": {
        // Only ever seen by the callee that just sent "accept" â€” the
        // caller's offer, waiting for this side's answer.
        updateStatus("connecting");
        if (pcRef.current) cleanupPeer();
        const stream = await getMic();
        const pc = createPeer();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit));
        await flushPendingIceCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal("answer", { sdp: answer });
        break;
      }

      case "answer":
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit),
          );
          await flushPendingIceCandidates();
        }
        break;

      case "ice-candidate":
        if (payload.candidate) {
          const candidate = payload.candidate as RTCIceCandidateInit;
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
    }
  }, [cleanupPeer, createPeer, flushPendingIceCandidates, getMic, onCallEnded, onIncomingCall, sendSignal, updateStatus]);

  // Always call the latest handleSignal without needing it in the polling
  // effect's deps (which would otherwise restart the poll loop every time
  // any of handleSignal's many dependencies change reference).
  const handleSignalRef = useRef(handleSignal);
  useEffect(() => { handleSignalRef.current = handleSignal; }, [handleSignal]);

  // â”€â”€ Polling loop â€” replaces the old persistent WebSocket entirely â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    stoppedRef.current = false;
    lastIdRef.current = 0;
    pollFailuresRef.current = 0;

    const applyPeerOnline = (online: boolean) => {
      if (online === peerOnlineRef.current) return;
      peerOnlineRef.current = online;
      setPeerOnline(online);
      if (!online && (statusRef.current === "ringing" || statusRef.current === "in-call")) {
        cleanupPeer();
        updateStatus("ended");
        onCallEnded?.();
        setTimeout(() => updateStatus("ready"), 2000);
      }
    };

    if (USE_FIREBASE_FOR_CALL_SIGNALING && isFirebaseSignalingConfigured()) {
      updateStatus("connecting-ws");
      void createFirebaseSignaling({
        room,
        role,
        onSignal: (type, payload) => handleSignalRef.current(type, payload),
        onPeerOnline: applyPeerOnline,
        onError: (message) => { if (!stoppedRef.current) setError(message); },
      }).then((channel) => {
        if (stoppedRef.current) { channel.close(); return; }
        firebaseChannelRef.current = channel;
        setError(null);
        updateStatus("ready");
      }).catch((cause) => {
        if (stoppedRef.current) return;
        const message = cause instanceof Error ? cause.message : "Firebase signaling unavailable";
        setError(`${message}. Check Firebase Authentication and Database rules.`);
        updateStatus("error");
      });

      return () => {
        stoppedRef.current = true;
        firebaseChannelRef.current?.close();
        firebaseChannelRef.current = null;
        cleanupPeer();
      };
    }

    updateStatus("ready");
    const poll = async () => {
      if (stoppedRef.current) return;
      try {
        const res = await fetch(`${apiUrl}/call/${room}/poll?role=${role}&after_id=${lastIdRef.current}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (pollFailuresRef.current >= POLL_FAILURE_THRESHOLD && statusRef.current === "error") {
          setError(null);
          updateStatus("ready");
        }
        pollFailuresRef.current = 0;
        const data = await res.json();
        applyPeerOnline(Boolean(data.peer_online));
        for (const sig of (data.signals as Array<{ type: string; payload: Record<string, unknown> }> | undefined) ?? []) {
          await handleSignalRef.current(sig.type, sig.payload);
        }
        if (typeof data.latest_id === "number") lastIdRef.current = data.latest_id;
      } catch {
        pollFailuresRef.current += 1;
        if (pollFailuresRef.current === POLL_FAILURE_THRESHOLD && !["connecting", "in-call"].includes(statusRef.current)) {
          setError("Can't reach the Monto signaling server — check your connection or re-pair.");
          updateStatus("error");
        }
      }
      if (!stoppedRef.current) pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };
    void poll();

    return () => {
      stoppedRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      cleanupPeer();
    };
  }, [apiUrl, room, role]); // eslint-disable-line react-hooks/exhaustive-deps
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

  // No-answer timeout â€” a ring/incoming call gets a full 2 minutes to reach
  // "in-call" before this side gives up and ends it on its own.
  const noAnswerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (noAnswerTimerRef.current) {
      clearTimeout(noAnswerTimerRef.current);
      noAnswerTimerRef.current = null;
    }
    if (status === "ringing" || status === "incoming" || status === "connecting") {
      noAnswerTimerRef.current = setTimeout(() => {
        noAnswerTimerRef.current = null;
        if (statusRef.current === "in-call") return;
        sendSignal("missed");
        cleanupPeer();
        updateStatus("ended");
        onCallEnded?.();
        setTimeout(() => updateStatus("ready"), 2000);
      }, 60000);
    }
    return () => {
      if (noAnswerTimerRef.current) clearTimeout(noAnswerTimerRef.current);
    };
  }, [status, cleanupPeer, onCallEnded, sendSignal, updateStatus]);

  const ringParent = useCallback(() => {
    if (statusRef.current !== "ready") return;
    updateStatus("ringing");
    sendSignal("ring");
  }, [sendSignal, updateStatus]);

  const acceptCall = useCallback(() => {
    if (statusRef.current !== "incoming") return;
    updateStatus("connecting");
    sendSignal("accept");
  }, [sendSignal, updateStatus]);

  const rejectCall = useCallback(() => {
    sendSignal("reject");
    updateStatus("ready");
  }, [sendSignal, updateStatus]);

  const hangUp = useCallback(() => {
    sendSignal("hangup");
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
