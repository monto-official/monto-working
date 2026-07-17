"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneOff, Mic, MicOff } from "lucide-react";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";

interface CallScreenProps {
  callee: "mom" | "dad";
  onEnd: () => void;
}

const SIGNALING_URL =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    .replace(/^http/, "ws") + "/ws/call";

export function CallScreen({ callee, onEnd }: CallScreenProps) {
  const displayName = callee === "mom" ? "Mom 💜" : "Dad 💙";
  const avatar      = callee === "mom" ? "👩" : "👨";

  const { status, isMuted, durationFormatted, peerOnline, error,
          ringParent, hangUp, toggleMute } = useWebRTCCall({
    role: "child",
    signalingUrl: SIGNALING_URL,
    onCallEnded: onEnd,
  });

  // Auto-ring once ready
  const ranRef = useRef(false);
  useEffect(() => {
    if (status === "ready" && !ranRef.current) {
      ranRef.current = true;
      ringParent();
    }
  }, [status, ringParent]);

  const handleHangup = () => { hangUp(); onEnd(); };

  const statusText = {
    idle:           "Starting...",
    "connecting-ws":"Connecting...",
    ready:          "Ready...",
    ringing:        "Ringing...",
    incoming:       "Incoming",
    connecting:     "Connecting call...",
    "in-call":      `● ${durationFormatted}`,
    ended:          "Call ended",
    error:          error || "Connection error",
  }[status] ?? status;

  const isConnected = status === "in-call";
  const isRinging   = status === "ringing" || status === "connecting";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between py-16 px-6"
      style={{ background: "linear-gradient(160deg, #050505 0%, #1a0a2e 50%, #050505 100%)" }}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Callee info */}
      <div className="flex flex-col items-center gap-5 mt-6">
        <div className="relative flex items-center justify-center">
          {isRinging && [0,1,2].map(i => (
            <motion.div key={i} className="absolute rounded-full"
              style={{ width: 96+i*40, height: 96+i*40, border: "2px solid rgba(167,139,250,0.5)" }}
              animate={{ scale:[1,1.2,1], opacity:[0.6,0,0.6] }}
              transition={{ duration: 1.8, delay: i*0.45, repeat: Infinity }}
            />
          ))}
          <motion.div
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl relative z-10"
            style={{
              background: "linear-gradient(135deg, #7C3AED, #EC4899)",
              boxShadow: isConnected
                ? "0 0 0 4px rgba(167,139,250,0.3), 0 0 60px rgba(124,58,237,0.6)"
                : "0 0 40px rgba(124,58,237,0.4)",
            }}
            animate={isConnected ? { boxShadow: [
              "0 0 0 4px rgba(167,139,250,0.2), 0 0 40px rgba(124,58,237,0.4)",
              "0 0 0 8px rgba(167,139,250,0.4), 0 0 70px rgba(124,58,237,0.7)",
              "0 0 0 4px rgba(167,139,250,0.2), 0 0 40px rgba(124,58,237,0.4)",
            ]} : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {avatar}
          </motion.div>
        </div>

        <h1 className="text-3xl font-bold text-white">{displayName}</h1>

        <p className={`text-sm font-semibold ${
          isConnected ? "text-emerald-400" :
          status === "error" ? "text-red-400" : "text-purple-300"
        }`}>
          {statusText}
        </p>

        {!peerOnline && status === "ringing" && (
          <p className="text-xs text-white/40 text-center max-w-xs">
            Parent app is not open. Ask them to open the Monto Parent app.
          </p>
        )}
      </div>

      {/* Waveform when connected */}
      <AnimatePresence>
        {isConnected && (
          <motion.div className="flex items-center gap-1"
            initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
          >
            {Array.from({ length: 20 }, (_, i) => {
              const base = 6 + Math.sin(i * 0.75) * 10;
              return (
                <motion.div key={i} className="w-1 rounded-full bg-purple-400"
                  animate={{ height:[base, base+Math.random()*20+4, base] }}
                  transition={{ duration:0.4+Math.random()*0.3, repeat:Infinity, delay:i*0.04, ease:"easeInOut" }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-8">
          {/* Mute */}
          <div className="flex flex-col items-center gap-2">
            <motion.button onClick={toggleMute}
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: isMuted ? "linear-gradient(135deg,#7C3AED,#A855F7)" : "rgba(255,255,255,0.1)",
                border: isMuted ? "none" : "1px solid rgba(255,255,255,0.15)",
                boxShadow: isMuted ? "0 0 30px rgba(124,58,237,0.6)" : "none",
              }}
              whileHover={{ scale:1.08 }} whileTap={{ scale:0.9 }}
            >
              {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white/60" />}
            </motion.button>
            <span className="text-white/30 text-xs">{isMuted ? "Unmute" : "Mute"}</span>
          </div>

          {/* Hang up */}
          <div className="flex flex-col items-center gap-2">
            <motion.button onClick={handleHangup}
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg,#EF4444,#B91C1C)",
                boxShadow: "0 0 40px rgba(239,68,68,0.5)",
              }}
              whileHover={{ scale:1.08 }} whileTap={{ scale:0.9 }}
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
