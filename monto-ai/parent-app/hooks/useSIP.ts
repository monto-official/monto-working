"use client";
/**
 * useSIP — JsSIP WebRTC SIP client hook for the Monto Parent App.
 *
 * Handles:
 *  - Registration with Asterisk over WebSocket
 *  - Incoming calls from the Monto box
 *  - Outgoing calls to the Monto box extension
 *  - Media stream (audio) management
 *  - Clean teardown on unmount
 */
import { useEffect, useRef, useCallback, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
export type SIPStatus =
  | "disconnected"
  | "connecting"
  | "registered"
  | "incoming"
  | "calling"
  | "in-call"
  | "error";

export interface SIPConfig {
  wsUrl:          string;   // e.g. "ws://192.168.1.100:8088/ws"
  username:       string;   // e.g. "parent"
  password:       string;
  domain:         string;   // e.g. "192.168.1.100"
  montoExtension: string;   // e.g. "monto"
}

export interface UseSIPReturn {
  status:       SIPStatus;
  callDuration: number;      // seconds since call connected
  incomingFrom: string | null;
  isMuted:      boolean;
  answer:       () => void;
  hangup:       () => void;
  call:         () => void;  // call the Monto box
  toggleMute:   () => void;
  error:        string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useSIP(config: SIPConfig): UseSIPReturn {
  const [status, setStatus]           = useState<SIPStatus>("disconnected");
  const [incomingFrom, setIncomingFrom] = useState<string | null>(null);
  const [isMuted, setIsMuted]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const uaRef           = useRef<any>(null);
  const sessionRef      = useRef<any>(null);
  const remoteAudioRef  = useRef<HTMLAudioElement | null>(null);
  const timerRef        = useRef<NodeJS.Timeout | null>(null);
  const callStartRef    = useRef<number>(0);

  // ── Duration timer ─────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    callStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallDuration(0);
  }, []);

  // ── Attach remote audio stream to <audio> element ─────────────────────────
  const attachAudio = useCallback((stream: MediaStream) => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      audio.controls = false;
      remoteAudioRef.current = audio;
    }
    remoteAudioRef.current.srcObject = stream;
    remoteAudioRef.current.play().catch(() => {});
  }, []);

  const detachAudio = useCallback(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  // ── Session event wiring ──────────────────────────────────────────────────
  const wireSession = useCallback((session: any) => {
    sessionRef.current = session;

    session.on("confirmed", () => {
      setStatus("in-call");
      startTimer();
    });

    session.on("ended", () => {
      setStatus("registered");
      setIncomingFrom(null);
      setIsMuted(false);
      stopTimer();
      detachAudio();
      sessionRef.current = null;
    });

    session.on("failed", (e: any) => {
      const cause = e?.cause || "Unknown error";
      setError(`Call failed: ${cause}`);
      setStatus("registered");
      setIncomingFrom(null);
      stopTimer();
      detachAudio();
      sessionRef.current = null;
      setTimeout(() => setError(null), 5000);
    });

    session.on("peerconnection", (e: any) => {
      const pc: RTCPeerConnection = e.peerconnection;
      pc.ontrack = (event) => {
        if (event.streams?.[0]) {
          attachAudio(event.streams[0]);
        }
      };
    });
  }, [startTimer, stopTimer, attachAudio, detachAudio]);

  // ── JsSIP init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    let ua: any;

    const init = async () => {
      // Dynamic import — JsSIP uses browser globals, must be client-side only
      const JsSIP = (await import("jssip")).default;

      // Suppress JsSIP internal logs in production
      JsSIP.debug.disable("JsSIP:*");

      const socket = new JsSIP.WebSocketInterface(config.wsUrl);

      ua = new JsSIP.UA({
        sockets:              [socket],
        uri:                  `sip:${config.username}@${config.domain}`,
        password:             config.password,
        register:             true,
        register_expires:     120,
        connection_recovery_min_interval: 2,
        connection_recovery_max_interval: 30,
      });

      ua.on("connecting", () => setStatus("connecting"));

      ua.on("connected", () => {
        setError(null);
      });

      ua.on("disconnected", () => {
        if (status !== "error") setStatus("disconnected");
      });

      ua.on("registered", () => {
        setStatus("registered");
        setError(null);
      });

      ua.on("unregistered", () => {
        setStatus("disconnected");
      });

      ua.on("registrationFailed", (e: any) => {
        setStatus("error");
        setError(`Registration failed: ${e?.cause || "unknown"}`);
      });

      // ── Incoming call ────────────────────────────────────────────────────
      ua.on("newRTCSession", (e: any) => {
        const session = e.session;
        if (session.direction === "incoming") {
          const from = session.remote_identity?.display_name ||
                       session.remote_identity?.uri?.user ||
                       "Monto Box";
          setIncomingFrom(from);
          setStatus("incoming");
          wireSession(session);
        }
        // outgoing sessions are wired in call()
      });

      setStatus("connecting");
      ua.start();
      uaRef.current = ua;
    };

    init().catch((err) => {
      setStatus("error");
      setError(`Failed to initialise SIP: ${err.message}`);
    });

    return () => {
      stopTimer();
      if (ua) {
        try { ua.stop(); } catch {}
      }
    };
    // Only re-run when config changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.wsUrl, config.username, config.password, config.domain]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const answer = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    session.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    });
    setStatus("in-call");
  }, []);

  const hangup = useCallback(() => {
    const session = sessionRef.current;
    if (session) {
      try { session.terminate(); } catch {}
    }
    setStatus("registered");
    setIncomingFrom(null);
    stopTimer();
    detachAudio();
    sessionRef.current = null;
  }, [stopTimer, detachAudio]);

  const call = useCallback(async () => {
    const ua = uaRef.current;
    if (!ua || status !== "registered") return;

    try {
      const JsSIP = (await import("jssip")).default;
      const target = `sip:${config.montoExtension}@${config.domain}`;

      const session = ua.call(target, {
        mediaConstraints: { audio: true, video: false },
        pcConfig: {
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        },
        eventHandlers: {
          peerconnection: (e: any) => {
            const pc: RTCPeerConnection = e.peerconnection;
            pc.ontrack = (event) => {
              if (event.streams?.[0]) attachAudio(event.streams[0]);
            };
          },
        },
      });

      wireSession(session);
      setStatus("calling");
    } catch (err: any) {
      setError(`Call error: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    }
  }, [status, config.montoExtension, config.domain, wireSession, attachAudio]);

  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    if (isMuted) {
      session.unmute({ audio: true });
    } else {
      session.mute({ audio: true });
    }
    setIsMuted((m) => !m);
  }, [isMuted]);

  return {
    status,
    callDuration,
    incomingFrom,
    isMuted,
    answer,
    hangup,
    call,
    toggleMute,
    error,
  };
}
