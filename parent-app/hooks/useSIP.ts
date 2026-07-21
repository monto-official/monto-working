"use client";
/**
 * useSIP — JsSIP-based SIP hook for the Monto Parent App.
 *
 * Handles:
 *  - UA registration with Asterisk via WebSocket
 *  - Outbound calls  → callMonto()
 *  - Inbound calls   → auto-surfaces via onIncomingCall callback + answerCall()
 *  - Hang up         → hangUp()
 *  - Audio routing   → remote audio piped to a hidden <audio> element
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CallState, CallDirection, CallLogEntry, SIPConfig } from "@/types";

// JsSIP is loaded dynamically to avoid SSR issues (it uses browser APIs)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsSIPType = typeof import("jssip");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UAType = InstanceType<JsSIPType["UA"]>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RTCSessionType = any;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseSIPReturn {
  callState: CallState;
  callDirection: CallDirection | null;
  callDuration: number;         // seconds, counts up while in-call
  callLog: CallLogEntry[];
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  isMuted: boolean;

  callMonto: () => void;
  answerCall: () => void;
  declineCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  reconnect: () => void;
  clearLog: () => void;
}

export function useSIP(config: SIPConfig): UseSIPReturn {
  const [callState, setCallState]           = useState<CallState>("unregistered");
  const [callDirection, setCallDirection]   = useState<CallDirection | null>(null);
  const [callDuration, setCallDuration]     = useState(0);
  const [callLog, setCallLog]               = useState<CallLogEntry[]>([]);
  const [isMuted, setIsMuted]               = useState(false);

  const uaRef              = useRef<UAType | null>(null);
  const sessionRef         = useRef<RTCSessionType | null>(null);
  const remoteAudioRef     = useRef<HTMLAudioElement | null>(null);
  const durationTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef   = useRef<Date | null>(null);
  const currentLogIdRef    = useRef<string | null>(null);
  const incomingSessionRef = useRef<RTCSessionType | null>(null);

  // ── Duration timer ─────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    callStartTimeRef.current = new Date();
    setCallDuration(0);
    durationTimerRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const secs = Math.floor(
          (Date.now() - callStartTimeRef.current.getTime()) / 1000
        );
        setCallDuration(secs);
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // ── Call log helpers ───────────────────────────────────────────────────────

  const addLogEntry = useCallback(
    (direction: CallDirection): string => {
      const id = generateId();
      currentLogIdRef.current = id;
      const entry: CallLogEntry = {
        id,
        direction,
        startedAt: new Date(),
        status: "answered",
      };
      setCallLog((prev) => [entry, ...prev].slice(0, 50)); // keep last 50
      return id;
    },
    []
  );

  const finaliseLogEntry = useCallback(
    (
      id: string,
      status: CallLogEntry["status"],
      endedAt: Date,
      startedAt?: Date
    ) => {
      setCallLog((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          const started = startedAt ?? e.startedAt;
          return {
            ...e,
            status,
            endedAt,
            durationSeconds: Math.floor(
              (endedAt.getTime() - started.getTime()) / 1000
            ),
          };
        })
      );
    },
    []
  );

  // ── Remote audio routing ───────────────────────────────────────────────────

  const attachRemoteAudio = useCallback((session: RTCSessionType) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session.connection.addEventListener("addstream", (e: any) => {
      if (remoteAudioRef.current && e.stream) {
        remoteAudioRef.current.srcObject = e.stream;
        remoteAudioRef.current.play().catch(() => {
          // autoplay policy — user gesture already occurred for a call so this
          // should succeed, but we swallow the error gracefully
        });
      }
    });

    // Modern API (replaces deprecated addstream)
    session.connection.addEventListener("track", (e: RTCTrackEvent) => {
      if (remoteAudioRef.current && e.streams && e.streams[0]) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    });
  }, []);

  // ── Session event wiring ───────────────────────────────────────────────────

  const wireSessionEvents = useCallback(
    (session: RTCSessionType, direction: CallDirection, logId: string) => {
      sessionRef.current = session;

      session.on("confirmed", () => {
        setCallState("in-call");
        startTimer();
        attachRemoteAudio(session);
      });

      session.on("failed", (e: { cause: string }) => {
        const endedAt = new Date();
        stopTimer();
        finaliseLogEntry(logId, "failed", endedAt, callStartTimeRef.current ?? undefined);
        sessionRef.current = null;
        setCallState("registered");
        setCallDirection(null);
        setCallDuration(0);
        console.warn("[SIP] Call failed:", e.cause);
      });

      session.on("ended", () => {
        const endedAt = new Date();
        stopTimer();
        if (currentLogIdRef.current) {
          finaliseLogEntry(
            currentLogIdRef.current,
            "answered",
            endedAt,
            callStartTimeRef.current ?? undefined
          );
        }
        sessionRef.current = null;
        setCallState("registered");
        setCallDirection(null);
        setCallDuration(0);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = null;
        }
      });
    },
    [attachRemoteAudio, finaliseLogEntry, startTimer, stopTimer]
  );

  // ── UA initialisation ──────────────────────────────────────────────────────

  const initUA = useCallback(async () => {
    if (uaRef.current) {
      try { uaRef.current.stop(); } catch { /* ignore */ }
      uaRef.current = null;
    }

    setCallState("registering");

    let JsSIP: JsSIPType;
    try {
      JsSIP = await import("jssip");
    } catch (err) {
      console.error("[SIP] Failed to load JsSIP:", err);
      setCallState("error");
      return;
    }

    // Suppress JsSIP debug noise
    JsSIP.debug.disable("JsSIP:*");

    const socket = new JsSIP.WebSocketInterface(config.wsUrl);

    const ua = new JsSIP.UA({
      sockets:            [socket],
      uri:                `sip:${config.username}@${config.domain}`,
      password:           config.password,
      register:           true,
      register_expires:   120,
      // Keep the WebSocket alive
      connection_recovery_min_interval: 2,
      connection_recovery_max_interval: 30,
    });

    uaRef.current = ua;

    ua.on("registered", () => {
      setCallState("registered");
    });

    ua.on("unregistered", () => {
      setCallState("unregistered");
    });

    ua.on("registrationFailed", (e: { cause?: string }) => {
      console.error("[SIP] Registration failed:", e.cause);
      setCallState("error");
    });

    // ── Incoming call ────────────────────────────────────────────────────────
    ua.on("newRTCSession", (data: { originator: string; session: RTCSessionType }) => {
      const { originator, session } = data;

      if (originator === "remote") {
        // Incoming call
        if (sessionRef.current) {
          // Already in a call — reject the new one
          session.terminate();
          return;
        }

        incomingSessionRef.current = session;
        setCallState("incoming");
        setCallDirection("inbound");

        const logId = addLogEntry("inbound");
        // Update status to missed if they don't answer within 60s
        const missedTimer = setTimeout(() => {
          if (callState === "incoming") {
            finaliseLogEntry(logId, "missed", new Date());
            incomingSessionRef.current?.terminate();
            incomingSessionRef.current = null;
            setCallState("registered");
            setCallDirection(null);
          }
        }, 60_000);

        session.on("ended",  () => clearTimeout(missedTimer));
        session.on("failed", () => {
          clearTimeout(missedTimer);
          finaliseLogEntry(logId, "missed", new Date());
          incomingSessionRef.current = null;
          setCallState("registered");
          setCallDirection(null);
        });
      }
    });

    ua.start();
  }, [addLogEntry, config, finaliseLogEntry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mount / config change
  useEffect(() => {
    initUA();
    return () => {
      stopTimer();
      if (uaRef.current) {
        try { uaRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, [initUA, stopTimer]);

  // ── Public actions ─────────────────────────────────────────────────────────

  /** Place an outbound call to the Monto box extension */
  const callMonto = useCallback(() => {
    const ua = uaRef.current;
    if (!ua || callState !== "registered") return;

    const montoExt =
      process.env.NEXT_PUBLIC_MONTO_BOX_EXTENSION || "monto";

    const logId = addLogEntry("outbound");
    setCallState("calling");
    setCallDirection("outbound");

    const session = ua.call(`sip:${montoExt}@${config.domain}`, {
      mediaConstraints:  { audio: true, video: false },
      pcConfig: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    });

    wireSessionEvents(session, "outbound", logId);
  }, [addLogEntry, callState, config.domain, wireSessionEvents]);

  /** Answer an incoming call */
  const answerCall = useCallback(() => {
    const session = incomingSessionRef.current;
    if (!session) return;

    sessionRef.current = session;
    incomingSessionRef.current = null;

    session.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    });

    const logId = currentLogIdRef.current ?? generateId();
    wireSessionEvents(session, "inbound", logId);
  }, [wireSessionEvents]);

  /** Decline / reject incoming call */
  const declineCall = useCallback(() => {
    const session = incomingSessionRef.current;
    if (session) {
      session.terminate({ status_code: 486, reason_phrase: "Busy Here" });
      incomingSessionRef.current = null;
    }
    if (currentLogIdRef.current) {
      finaliseLogEntry(currentLogIdRef.current, "declined", new Date());
    }
    setCallState("registered");
    setCallDirection(null);
  }, [finaliseLogEntry]);

  /** Hang up active or outgoing call */
  const hangUp = useCallback(() => {
    const session = sessionRef.current ?? incomingSessionRef.current;
    if (session) {
      try {
        session.terminate();
      } catch { /* ignore if already ended */ }
    }
    stopTimer();
    if (currentLogIdRef.current) {
      finaliseLogEntry(currentLogIdRef.current, "answered", new Date());
    }
    sessionRef.current = null;
    incomingSessionRef.current = null;
    setCallState("registered");
    setCallDirection(null);
    setCallDuration(0);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, [finaliseLogEntry, stopTimer]);

  /** Toggle microphone mute */
  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    if (isMuted) {
      session.unmute({ audio: true });
    } else {
      session.mute({ audio: true });
    }
    setIsMuted((prev) => !prev);
  }, [isMuted]);

  /** Force re-register (e.g. after network interruption) */
  const reconnect = useCallback(() => {
    initUA();
  }, [initUA]);

  const clearLog = useCallback(() => setCallLog([]), []);

  return {
    callState,
    callDirection,
    callDuration,
    callLog,
    remoteAudioRef,
    isMuted,
    callMonto,
    answerCall,
    declineCall,
    hangUp,
    toggleMute,
    reconnect,
    clearLog,
  };
}
