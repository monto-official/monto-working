"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneOff, Mic, MicOff } from "lucide-react";

interface CallScreenProps {
  callee: "mom" | "dad";
  onEnd: () => void;
}

type CallState = "ringing" | "connected" | "ended";

// ── Phrases that trigger hang up ─────────────────────────────────────────────
const HANGUP_PHRASES = [
  "cut the call", "end call", "hang up", "hangup", "disconnect",
  "stop call", "bye", "goodbye", "cut call", "cancel call",
  "फोन काट", "फोन राख",
];

function isHangupPhrase(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return HANGUP_PHRASES.some(p => lower.includes(p));
}

export function CallScreen({ callee, onEnd }: CallScreenProps) {
  const [callState, setCallState]   = useState<CallState>("ringing");
  const [duration, setDuration]     = useState(0);
  const [isMicOn, setIsMicOn]       = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError]     = useState<string | null>(null);

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const silenceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpokenRef      = useRef(false);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const animFrameRef      = useRef<number>(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const displayName = callee === "mom" ? "Mom 💜" : "Dad 💙";
  const avatar      = callee === "mom" ? "👩" : "👨";

  // ── Auto-connect after 3s ────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setCallState("connected"), 3000);
    return () => clearTimeout(t);
  }, []);

  // ── Call timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (callState !== "connected") return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [callState]);

  const formatTime = (s: number) => {
    const m   = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // ── Cleanup all audio resources ───────────────────────────────────────────
  const cleanupAudio = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
    setAudioLevel(0);
    setIsListening(false);
    hasSpokenRef.current = false;
  }, []);

  // ── Process recorded audio for hangup commands ────────────────────────────
  const processChunks = useCallback(async (chunks: Blob[], mimeType: string) => {
    if (chunks.length === 0) return;
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size < 500) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const formData = new FormData();
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";
      formData.append("audio", blob, `call_audio.${ext}`);

      const res = await fetch(`${API_URL}/voice/query`, {
        method: "POST",
        headers: { "X-Session-Id": "call-session" },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const text: string = data.transcript || "";
        console.log("[CallScreen] heard:", text);
        if (isHangupPhrase(text)) {
          console.log("[CallScreen] hangup detected:", text);
          handleHangup();
        }
      }
    } catch (err) {
      console.warn("[CallScreen] voice query failed:", err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start mic + silence detection ─────────────────────────────────────────
  const startMic = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;

      // Audio level analyser
      const ctx      = new AudioContext();
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const SPEECH_THRESH = 0.08;
      const SILENCE_MS    = 1800;

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const level = Math.min(avg / 80, 1);
        setAudioLevel(level);

        if (level > SPEECH_THRESH) {
          hasSpokenRef.current = true;
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        } else if (hasSpokenRef.current && !silenceTimerRef.current) {
          // Silence after speech — stop and process
          silenceTimerRef.current = setTimeout(() => {
            silenceTimerRef.current = null;
            if (mediaRecorderRef.current?.state === "recording") {
              mediaRecorderRef.current.stop();
            }
          }, SILENCE_MS);
        }
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();

      // MediaRecorder
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
        .find(m => MediaRecorder.isTypeSupported(m)) ?? "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : {});
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const captured = [...chunksRef.current];
        chunksRef.current = [];
        hasSpokenRef.current = false;
        await processChunks(captured, mimeType || "audio/webm");

        // Restart recorder for continuous listening
        if (streamRef.current && isMicOn) {
          const newRecorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : {});
          mediaRecorderRef.current = newRecorder;
          newRecorder.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
          newRecorder.onstop = recorder.onstop;
          newRecorder.start(250);
        }
      };

      recorder.start(250);
      setIsListening(true);
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "NotAllowedError"
        ? "Mic permission denied"
        : "Could not start mic";
      setMicError(msg);
      setIsMicOn(false);
    }
  }, [isMicOn, processChunks]);

  // ── Toggle mic ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isMicOn) {
      startMic();
    } else {
      cleanupAudio();
    }
    return () => cleanupAudio();
  }, [isMicOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hang up ───────────────────────────────────────────────────────────────
  const handleHangup = useCallback(() => {
    cleanupAudio();
    setCallState("ended");
    setTimeout(onEnd, 700);
  }, [cleanupAudio, onEnd]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between py-16 px-6"
      style={{ background: "linear-gradient(160deg, #050505 0%, #1a0a2e 50%, #050505 100%)" }}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* ── Top — callee info ── */}
      <div className="flex flex-col items-center gap-5 mt-6">
        {/* Avatar with pulse rings */}
        <div className="relative flex items-center justify-center">
          {callState === "ringing" && [0, 1, 2].map(i => (
            <motion.div key={i}
              className="absolute rounded-full"
              style={{
                width: 96 + i * 40, height: 96 + i * 40,
                border: "2px solid rgba(167,139,250,0.5)",
              }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.8, delay: i * 0.45, repeat: Infinity, ease: "easeOut" }}
            />
          ))}

          <motion.div
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl relative z-10"
            style={{
              background: "linear-gradient(135deg, #7C3AED, #EC4899)",
              boxShadow: callState === "connected"
                ? "0 0 0 4px rgba(167,139,250,0.3), 0 0 60px rgba(124,58,237,0.6)"
                : "0 0 40px rgba(124,58,237,0.4)",
            }}
            animate={callState === "connected"
              ? { boxShadow: [
                  "0 0 0 4px rgba(167,139,250,0.2), 0 0 40px rgba(124,58,237,0.4)",
                  "0 0 0 8px rgba(167,139,250,0.4), 0 0 70px rgba(124,58,237,0.7)",
                  "0 0 0 4px rgba(167,139,250,0.2), 0 0 40px rgba(124,58,237,0.4)",
                ]}
              : {}
            }
            transition={{ duration: 2, repeat: Infinity }}
          >
            {avatar}
          </motion.div>
        </div>

        {/* Name */}
        <h1 className="text-3xl font-bold text-white tracking-tight">{displayName}</h1>

        {/* Status */}
        <AnimatePresence mode="wait">
          {callState === "ringing" && (
            <motion.div key="ringing" className="flex items-center gap-2"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400"
                  animate={{ scale:[1,1.7,1], opacity:[0.4,1,0.4] }}
                  transition={{ duration:0.8, delay:i*0.22, repeat:Infinity }}
                />
              ))}
              <span className="text-purple-300 text-sm font-medium ml-1">Calling...</span>
            </motion.div>
          )}
          {callState === "connected" && (
            <motion.p key="connected" className="text-emerald-400 text-sm font-semibold tracking-wide"
              initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
            >
              ● Connected · {formatTime(duration)}
            </motion.p>
          )}
          {callState === "ended" && (
            <motion.p key="ended" className="text-white/30 text-sm"
              initial={{ opacity:0 }} animate={{ opacity:1 }}
            >
              Call ended
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ── Middle — waveform ── */}
      <div className="flex flex-col items-center gap-3">
        <AnimatePresence>
          {callState === "connected" && (
            <motion.div className="flex items-center gap-1"
              initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
            >
              {Array.from({ length: 20 }, (_, i) => {
                const base = 6 + Math.sin(i * 0.75) * 10;
                const reactive = isMicOn ? audioLevel * 30 : 0;
                return (
                  <motion.div key={i}
                    className="w-1 rounded-full"
                    style={{ background: isMicOn ? "#A78BFA" : "rgba(167,139,250,0.4)" }}
                    animate={{ height: [base, base + reactive + Math.random() * 8, base] }}
                    transition={{ duration: 0.4 + Math.random() * 0.3, repeat:Infinity, delay: i*0.04, ease:"easeInOut" }}
                  />
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic hint */}
        <AnimatePresence>
          {isMicOn && isListening && (
            <motion.p className="text-purple-300/70 text-xs"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            >
              Say "cut the call" to hang up
            </motion.p>
          )}
        </AnimatePresence>
        {micError && (
          <p className="text-red-400 text-xs">{micError}</p>
        )}
      </div>

      {/* ── Bottom — controls ── */}
      <div className="flex flex-col items-center gap-6">
        {/* Mic + Hangup buttons */}
        <div className="flex items-center gap-8">
          {/* Mic toggle */}
          <div className="flex flex-col items-center gap-2">
            <motion.button
              onClick={() => setIsMicOn(v => !v)}
              className="w-16 h-16 rounded-full flex items-center justify-center focus:outline-none"
              style={{
                background: isMicOn
                  ? "linear-gradient(135deg, #7C3AED, #A855F7)"
                  : "rgba(255,255,255,0.1)",
                boxShadow: isMicOn
                  ? "0 0 30px rgba(124,58,237,0.6)"
                  : "none",
                border: isMicOn ? "none" : "1px solid rgba(255,255,255,0.15)",
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              animate={isMicOn ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {isMicOn
                ? <Mic className="w-7 h-7 text-white" />
                : <MicOff className="w-7 h-7 text-white/50" />
              }
            </motion.button>
            <span className="text-white/30 text-xs">{isMicOn ? "Mic on" : "Mic off"}</span>
          </div>

          {/* Hang up */}
          <div className="flex flex-col items-center gap-2">
            <motion.button
              onClick={handleHangup}
              className="w-20 h-20 rounded-full flex items-center justify-center focus:outline-none"
              style={{
                background: "linear-gradient(135deg, #EF4444, #B91C1C)",
                boxShadow: "0 0 40px rgba(239,68,68,0.5), 0 8px 32px rgba(0,0,0,0.4)",
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
            >
              <PhoneOff className="w-8 h-8 text-white" />
            </motion.button>
            <span className="text-white/30 text-xs">Hang up</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
