"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Play, Pause, Mic,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { YOGA_POSES } from "@/lib/media-content";
import { YogaPoseArt } from "@/components/YogaPoseArt";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { sendVoiceQuery, APIError } from "@/lib/api";

export default function YogaPage() {
  const router = useRouter();

  const [index, setIndex]       = useState(0);
  const [paused, setPaused]     = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);

  const recorder = useAudioRecorder();
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pose = YOGA_POSES[index];

  const goTo = useCallback((i: number) => {
    setIndex(((i % YOGA_POSES.length) + YOGA_POSES.length) % YOGA_POSES.length);
  }, []);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // ── Auto-advance to the next pose every durationSec seconds ──────────────
  useEffect(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (paused) return;

    advanceTimer.current = setTimeout(() => {
      setIndex(i => (i + 1) % YOGA_POSES.length);
    }, pose.durationSec * 1000);

    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [index, paused, pose.durationSec]);

  // ── Voice commands: "next", "back", "pause", "play" ─────────────────────
  const handleVoice = useCallback(async () => {
    if (recorder.recordingState === "recording") {
      const blob = await recorder.stopRecording();
      if (!blob || blob.size < 500) { setVoiceStatus(null); return; }
      setVoiceStatus("Thinking...");
      try {
        const result = await sendVoiceQuery(blob);
        const t = result.transcript.toLowerCase();
        setVoiceStatus(`"${result.transcript}"`);

        if (/next|skip/.test(t))        next();
        else if (/prev|back/.test(t))   prev();
        else if (/pause|stop/.test(t))  setPaused(true);
        else if (/play|resume|start/.test(t)) setPaused(false);

        setTimeout(() => setVoiceStatus(null), 3000);
      } catch (err) {
        setVoiceStatus(err instanceof APIError ? err.message : "Error");
        setTimeout(() => setVoiceStatus(null), 2500);
      }
    } else {
      await recorder.startRecording();
    }
  }, [recorder, next, prev]);

  const isRec = recorder.recordingState === "recording";

  return (
    <div className="min-h-dvh flex flex-col bg-black select-none">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 pt-safe pt-5 pb-3">
        <motion.button onClick={() => router.back()} whileTap={{ scale: 0.85 }}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-white" />
        </motion.button>
        <div className="text-center">
          <p className="text-white font-bold text-xl">🧘 Yoga Time</p>
          <p className="text-white/40 text-xs">Pose {index + 1} of {YOGA_POSES.length}</p>
        </div>
        <div className="w-10" />
      </header>

      {/* ── Pose card ── */}
      <div className="flex-1 flex flex-col px-4">
        <AnimatePresence mode="wait">
          <motion.div key={pose.id}
            className="rounded-3xl p-6 flex flex-col items-center flex-1"
            style={{ background: `linear-gradient(135deg, ${pose.color}25, ${pose.color}10)`, border: `1px solid ${pose.color}40` }}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          >
            {/* Illustration */}
            <div className="flex-1 flex items-center justify-center py-2">
              <YogaPoseArt poseId={pose.id} color={pose.color} size={220} />
            </div>

            {/* Name */}
            <div className="text-center mb-3">
              <p className="text-3xl mb-1">{pose.emoji}</p>
              <p className="text-white font-bold text-2xl leading-snug">{pose.name}</p>
              <p className="text-white/40 text-sm italic mt-0.5">{pose.sanskrit}</p>
            </div>

            {/* Instruction */}
            <p className="text-white/70 text-sm leading-relaxed text-center px-2 mb-4">
              {pose.instruction}
            </p>

            {/* Hold-time progress bar — drains over durationSec, restarts each pose */}
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-1">
              <motion.div
                key={`${pose.id}-${paused}`}
                className="h-full rounded-full"
                style={{ background: pose.color }}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: paused ? undefined : 0 }}
                transition={{ duration: pose.durationSec, ease: "linear" }}
              />
            </div>
            <p className="text-white/30 text-xs mb-2">
              {paused ? "Paused" : `Next pose in ${pose.durationSec}s`}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* ── Controls ── */}
        <div className="flex items-center justify-center gap-4 my-4">
          <motion.button onClick={prev} whileTap={{ scale: 0.9 }}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-white" />
          </motion.button>

          <motion.button onClick={() => setPaused(p => !p)} whileTap={{ scale: 0.9 }}
            className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: pose.color, boxShadow: `0 0 30px ${pose.color}60` }}>
            {paused
              ? <Play className="w-6 h-6 text-white ml-1" />
              : <Pause className="w-6 h-6 text-white" />}
          </motion.button>

          <motion.button onClick={next} whileTap={{ scale: 0.9 }}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <ChevronRight className="w-5 h-5 text-white" />
          </motion.button>
        </div>

        {/* ── Mic bar ── */}
        <div className="mb-3">
          <motion.button onClick={handleVoice}
            className="w-full rounded-2xl py-3 px-4 flex items-center justify-center gap-3"
            style={{
              background: isRec ? "linear-gradient(135deg,#EF4444,#DC2626)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${isRec ? "#EF4444" : "rgba(255,255,255,0.1)"}`,
            }}
            whileTap={{ scale: 0.97 }}
          >
            <Mic className={`w-4 h-4 ${isRec ? "text-white" : "text-white/60"}`} />
            <span className={`text-sm ${isRec ? "text-white font-medium" : "text-white/50"}`}>
              {isRec ? "Listening..." : 'Say "next", "back", or "pause"'}
            </span>
          </motion.button>

          <AnimatePresence>
            {voiceStatus && (
              <motion.p
                className="text-center text-xs text-white/50 mt-2"
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              >
                {voiceStatus}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ── Pose list ── */}
        <div className="pb-safe pb-6 space-y-2 overflow-y-auto max-h-40">
          {YOGA_POSES.map((p, i) => (
            <motion.button key={p.id} onClick={() => goTo(i)}
              className="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left"
              style={{
                background: i === index ? `${p.color}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${i === index ? p.color + "50" : "rgba(255,255,255,0.06)"}`,
              }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-xl flex-shrink-0">{p.emoji}</span>
              <p className={`text-sm font-semibold truncate ${i === index ? "text-white" : "text-white/60"}`}>
                {p.name}
              </p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
