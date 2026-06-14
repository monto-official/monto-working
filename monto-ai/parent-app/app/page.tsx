"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, PhoneOff, PhoneIncoming, Mic, MicOff,
  Wifi, WifiOff, Settings, AlertCircle, CheckCircle2,
  Volume2, Heart,
} from "lucide-react";
import { useSIP, type SIPStatus } from "@/hooks/useSIP";
import { cn, formatDuration } from "@/lib/utils";

// ── Config from env ─────────────────────────────────────────────────────────
const SIP_CONFIG = {
  wsUrl:          process.env.NEXT_PUBLIC_ASTERISK_WS_URL  ?? "ws://localhost:8088/ws",
  username:       process.env.NEXT_PUBLIC_SIP_USERNAME      ?? "parent",
  password:       process.env.NEXT_PUBLIC_SIP_PASSWORD      ?? "parentpass123",
  domain:         process.env.NEXT_PUBLIC_SIP_DOMAIN        ?? "localhost",
  montoExtension: process.env.NEXT_PUBLIC_MONTO_BOX_EXTENSION ?? "monto",
};

const MONTO_API = process.env.NEXT_PUBLIC_MONTO_API_URL ?? "http://localhost:8000";

// ── Status display helpers ──────────────────────────────────────────────────
const STATUS_LABEL: Record<SIPStatus, string> = {
  disconnected: "Not connected",
  connecting:   "Connecting...",
  registered:   "Ready",
  incoming:     "Incoming call",
  calling:      "Calling Monto...",
  "in-call":    "In call",
  error:        "Connection error",
};

const STATUS_COLOR: Record<SIPStatus, string> = {
  disconnected: "bg-slate-400",
  connecting:   "bg-yellow-400",
  registered:   "bg-emerald-400",
  incoming:     "bg-blue-400",
  calling:      "bg-yellow-400",
  "in-call":    "bg-emerald-400",
  error:        "bg-red-400",
};

// ── Avatar / ring component ─────────────────────────────────────────────────
function MontoAvatar({ status }: { status: SIPStatus }) {
  const pulse = status === "incoming" || status === "calling";
  const active = status === "in-call";

  return (
    <div className="relative flex items-center justify-center w-40 h-40 mx-auto">
      {/* Pulse rings for incoming/outgoing */}
      <AnimatePresence>
        {pulse && [0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-indigo-400"
            initial={{ width: 80, height: 80, opacity: 0.8 }}
            animate={{ width: 160 + i * 30, height: 160 + i * 30, opacity: 0 }}
            transition={{ duration: 1.5, delay: i * 0.4, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>

      {/* Avatar circle */}
      <motion.div
        className="relative z-10 w-36 h-36 rounded-full flex items-center justify-center"
        style={{
          background: active
            ? "linear-gradient(135deg, #059669, #10b981)"
            : "linear-gradient(135deg, #4f46e5, #7c3aed)",
          boxShadow: active
            ? "0 0 40px rgba(16,185,129,0.4)"
            : "0 0 40px rgba(99,102,241,0.3)",
        }}
        animate={active ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="text-6xl select-none">🤖</span>
      </motion.div>

      {/* Status dot */}
      <motion.div
        className={cn("absolute bottom-3 right-3 w-5 h-5 rounded-full border-2 border-[#0f0a1e]", STATUS_COLOR[status])}
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
}

// ── Sound wave indicator (active call) ─────────────────────────────────────
function SoundWave() {
  return (
    <div className="flex items-center gap-1 h-8">
      {[0.4, 0.8, 1.0, 0.7, 0.5, 0.9, 0.6].map((scale, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-emerald-400"
          animate={{ scaleY: [0.3, scale, 0.3] }}
          transition={{
            duration: 0.6,
            delay: i * 0.08,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ height: 28 }}
        />
      ))}
    </div>
  );
}

// ── Settings panel ─────────────────────────────────────────────────────────
function SettingsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />

          <motion.div
            className="relative z-10 w-full max-w-sm glass glass-border rounded-3xl p-6"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
          >
            <h2 className="text-white font-bold text-lg mb-4">Connection Settings</h2>
            <div className="space-y-3 text-sm text-white/60">
              <div>
                <span className="text-white/40 text-xs uppercase tracking-wide">WebSocket</span>
                <p className="text-white/80 font-mono text-xs mt-0.5 break-all">{SIP_CONFIG.wsUrl}</p>
              </div>
              <div>
                <span className="text-white/40 text-xs uppercase tracking-wide">SIP Extension</span>
                <p className="text-white/80 font-mono mt-0.5">{SIP_CONFIG.username}@{SIP_CONFIG.domain}</p>
              </div>
              <div>
                <span className="text-white/40 text-xs uppercase tracking-wide">Monto Extension</span>
                <p className="text-white/80 font-mono mt-0.5">{SIP_CONFIG.montoExtension}@{SIP_CONFIG.domain}</p>
              </div>
              <div>
                <span className="text-white/40 text-xs uppercase tracking-wide">Monto API</span>
                <p className="text-white/80 font-mono text-xs mt-0.5 break-all">{MONTO_API}</p>
              </div>
            </div>

            <p className="text-white/30 text-xs mt-4">
              Edit environment variables in <code className="text-indigo-400">.env.local</code> to change these settings.
            </p>

            <button
              onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-xl glass glass-border text-white/70 text-sm font-medium hover:bg-white/10 transition"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ParentApp() {
  const { status, callDuration, incomingFrom, isMuted, answer, hangup, call, toggleMute, error } =
    useSIP(SIP_CONFIG);

  const [showSettings, setShowSettings] = useState(false);
  const [montoOnline, setMontoOnline]   = useState<boolean | null>(null);

  // Periodically check if Monto box is online via backend /call/status
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${MONTO_API}/call/status`);
        if (res.ok) {
          const data = await res.json();
          setMontoOnline(data.monto_online ?? false);
        }
      } catch {
        setMontoOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 15_000);
    return () => clearInterval(interval);
  }, []);

  const isIdle    = status === "registered";
  const isActive  = status === "in-call";
  const isCalling = status === "calling" || status === "incoming";

  const handlePrimaryBtn = useCallback(() => {
    if (status === "incoming")  return answer();
    if (status === "calling")   return hangup();
    if (status === "in-call")   return hangup();
    if (status === "registered") return call();
  }, [status, answer, hangup, call]);

  return (
    <div
      className="min-h-dvh flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0f0a1e 0%, #1a0d35 50%, #0a1428 100%)" }}
    >
      {/* Stars */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 40 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top:  `${Math.random() * 100}%`,
              width:  Math.random() * 2 + 0.5,
              height: Math.random() * 2 + 0.5,
            }}
            animate={{ opacity: [0.1, 0.7, 0.1] }}
            transition={{
              duration: Math.random() * 3 + 2,
              delay:    Math.random() * 4,
              repeat:   Infinity,
            }}
          />
        ))}
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between px-5 pt-6 pb-2">
        {/* Monto box status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass glass-border">
          <motion.div
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              montoOnline === null ? "bg-slate-400" :
              montoOnline ? "bg-emerald-400" : "bg-red-400"
            )}
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-[10px] text-white/50 font-semibold tracking-wide">
            {montoOnline === null ? "CHECKING" : montoOnline ? "MONTO ONLINE" : "MONTO OFFLINE"}
          </span>
        </div>

        {/* Title */}
        <div className="text-center">
          <div className="font-bold text-xl text-white tracking-tight">
            <span className="text-indigo-400">M</span>onto Parent
          </div>
          <div className="text-[9px] tracking-[0.3em] text-white/30 uppercase">
            Stay Connected ✦
          </div>
        </div>

        {/* Settings */}
        <motion.button
          onClick={() => setShowSettings(true)}
          className="w-9 h-9 rounded-full glass glass-border flex items-center justify-center"
          whileTap={{ scale: 0.85 }}
        >
          <Settings className="w-4 h-4 text-white/50" />
        </motion.button>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pb-10 max-w-sm mx-auto w-full">

        {/* ── Avatar ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <MontoAvatar status={status} />
        </div>

        {/* ── Status text ─────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <AnimatePresence mode="wait">
            <motion.div key={status}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <motion.div
                  className={cn("w-2 h-2 rounded-full", STATUS_COLOR[status])}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-white font-semibold text-lg">
                  {STATUS_LABEL[status]}
                </span>
              </div>

              {/* In call: duration + sound wave */}
              {isActive && (
                <div className="flex flex-col items-center gap-2 mt-2">
                  <SoundWave />
                  <span className="text-emerald-400 font-mono text-sm">
                    {formatDuration(callDuration)}
                  </span>
                </div>
              )}

              {/* Incoming: who's calling */}
              {status === "incoming" && (
                <p className="text-white/60 text-sm mt-1">
                  from {incomingFrom}
                </p>
              )}

              {/* Idle: connection guidance */}
              {isIdle && (
                <p className="text-white/40 text-sm mt-1">
                  {montoOnline ? "Tap to call Monto 📞" : "Monto box is offline"}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="w-full mb-6 px-4 py-3 rounded-2xl flex items-center gap-3 glass"
              style={{ borderColor: "rgba(239,68,68,0.3)", border: "1px solid" }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Call controls ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-5">
          {/* Mute (only when in call) */}
          <AnimatePresence>
            {isActive && (
              <motion.button
                onClick={toggleMute}
                className="w-14 h-14 rounded-full glass glass-border flex items-center justify-center"
                whileTap={{ scale: 0.85 }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {isMuted
                  ? <MicOff className="w-6 h-6 text-red-400" />
                  : <Mic    className="w-6 h-6 text-white/70" />}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Primary call button */}
          <motion.button
            onClick={handlePrimaryBtn}
            disabled={status === "disconnected" || status === "connecting" || status === "error"}
            className="w-20 h-20 rounded-full flex items-center justify-center disabled:opacity-40 focus:outline-none"
            style={{
              background:
                isActive || status === "calling"
                  ? "linear-gradient(135deg, #ef4444, #dc2626)"
                  : status === "incoming"
                  ? "linear-gradient(135deg, #059669, #10b981)"
                  : "linear-gradient(135deg, #4f46e5, #7c3aed)",
              boxShadow:
                isActive || status === "calling"
                  ? "0 0 40px rgba(239,68,68,0.4), 0 8px 32px rgba(0,0,0,0.4)"
                  : status === "incoming"
                  ? "0 0 40px rgba(16,185,129,0.4), 0 8px 32px rgba(0,0,0,0.4)"
                  : "0 0 40px rgba(99,102,241,0.4), 0 8px 32px rgba(0,0,0,0.4)",
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
          >
            <AnimatePresence mode="wait">
              {isActive || status === "calling" ? (
                <motion.div key="hangup"
                  initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 400 }}>
                  <PhoneOff className="w-9 h-9 text-white" />
                </motion.div>
              ) : status === "incoming" ? (
                <motion.div key="answer"
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 400 }}>
                  <PhoneIncoming className="w-9 h-9 text-white" />
                </motion.div>
              ) : (
                <motion.div key="call"
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 400 }}>
                  <Phone className="w-9 h-9 text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Decline (only on incoming) */}
          <AnimatePresence>
            {status === "incoming" && (
              <motion.button
                onClick={hangup}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  boxShadow: "0 0 20px rgba(239,68,68,0.3)",
                }}
                whileTap={{ scale: 0.85 }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* ── Info cards ───────────────────────────────────────────────────── */}
        <div className="w-full mt-10 space-y-3">
          {/* SIP registration status */}
          <div className="px-4 py-3 rounded-2xl glass glass-border flex items-center gap-3">
            {status === "registered" || status === "in-call" || status === "incoming" || status === "calling" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : status === "connecting" ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Wifi className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              </motion.div>
            ) : (
              <WifiOff className="w-4 h-4 text-slate-400 flex-shrink-0" />
            )}
            <div>
              <p className="text-white/80 text-sm font-medium">
                {status === "registered" ? "Registered with Asterisk" :
                 status === "connecting" ? "Connecting to Asterisk..." :
                 "Not registered"}
              </p>
              <p className="text-white/30 text-xs">
                {SIP_CONFIG.username}@{SIP_CONFIG.domain}
              </p>
            </div>
          </div>

          {/* Audio note */}
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-3 rounded-2xl glass glass-border flex items-center gap-3"
              style={{ borderColor: "rgba(16,185,129,0.3)" }}
            >
              <Volume2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-emerald-300 text-sm">
                {isMuted ? "Microphone muted — tap mic to unmute" : "Audio connected — speak normally"}
              </p>
            </motion.div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="mt-8 flex items-center gap-1.5 text-white/20 text-xs">
          <Heart className="w-3 h-3" />
          <span>Made with love for Monto AI</span>
        </div>
      </main>

      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
