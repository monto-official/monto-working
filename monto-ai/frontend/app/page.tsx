"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { Volume2, VolumeX, Mic, Sparkles, MessageCircle, X, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useTTS } from "@/hooks/useTTS";
import { useConversation } from "@/hooks/useConversation";
import { useWakeWord } from "@/hooks/useWakeWord";
import { sendVoiceQuery, checkHealth, APIError } from "@/lib/api";
import { Emotion, RecordingState, Settings, VoiceQueryResponse } from "@/types";
import { cn } from "@/lib/utils";

// ── Emotion config ────────────────────────────────────────────────────────────
const EMOTION_CONFIG = {
  happy:     { color: "#FBBF24", glow: "#F59E0B", bg: "#78350F", emojis: ["😊","🌟","🎉","✨","🌈"] },
  excited:   { color: "#F472B6", glow: "#EC4899", bg: "#831843", emojis: ["🤩","🚀","⭐","🎊","💫"] },
  sad:       { color: "#60A5FA", glow: "#3B82F6", bg: "#1E3A5F", emojis: ["💛","🤗","💙","🌸"] },
  thinking:  { color: "#A78BFA", glow: "#8B5CF6", bg: "#3B1D6E", emojis: ["🤔","💭","💡","🔮"] },
  surprised: { color: "#34D399", glow: "#10B981", bg: "#064E3B", emojis: ["😲","✨","🎯","💥"] },
  neutral:   { color: "#818CF8", glow: "#6366F1", bg: "#1E1B4B", emojis: ["😊","🌟","✦"] },
  talking:   { color: "#818CF8", glow: "#6366F1", bg: "#1E1B4B", emojis: ["🔊","💬","✨"] },
} as const;

const GREETING_MESSAGES = [
  "Hi! I'm Monto, your AI friend! 🌟",
  "Ask me anything! I love chatting! 😊",
  "Let's learn something fun today! 🚀",
  "What's on your mind? I'm listening! 💭",
];

// ── Star background ───────────────────────────────────────────────────────────
const StarField = () => {
  const stars = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.5 + 0.5,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 4,
  })), []);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {stars.map(s => (
        <motion.div key={s.id}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }}
          animate={{ opacity: [0.1, 0.9, 0.1], scale: [0.8, 1.3, 0.8] }}
          transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
        />
      ))}
      {/* Nebula blobs */}
      <div className="absolute top-10 left-10 w-64 h-64 rounded-full opacity-10"
           style={{ background: "radial-gradient(circle, #7C3AED, transparent)" }} />
      <div className="absolute bottom-20 right-5 w-48 h-48 rounded-full opacity-10"
           style={{ background: "radial-gradient(circle, #EC4899, transparent)" }} />
      <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full opacity-8"
           style={{ background: "radial-gradient(circle, #3B82F6, transparent)" }} />
    </div>
  );
};

// ── Floating emoji burst ──────────────────────────────────────────────────────
const EmojiBurst = ({ emotion, trigger }: { emotion: string; trigger: number }) => {
  const cfg = EMOTION_CONFIG[emotion as keyof typeof EMOTION_CONFIG] ?? EMOTION_CONFIG.neutral;
  return (
    <AnimatePresence>
      {trigger > 0 && cfg.emojis.map((emoji, i) => (
        <motion.div key={`${trigger}-${i}`}
          className="fixed text-2xl pointer-events-none z-50 select-none"
          style={{
            left: `${30 + Math.random() * 40}%`,
            top: `${40 + Math.random() * 20}%`,
          }}
          initial={{ opacity: 0, scale: 0, y: 0 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0, 1.4, 1.2, 0.8], y: -120 - i * 20 }}
          transition={{ duration: 1.8, delay: i * 0.12, ease: "easeOut" }}
        >
          {emoji}
        </motion.div>
      ))}
    </AnimatePresence>
  );
};

// ── Mic visualizer bars ───────────────────────────────────────────────────────
const AudioBars = ({ level, color }: { level: number; color: string }) => (
  <div className="flex items-center gap-0.5 h-8">
    {Array.from({ length: 12 }, (_, i) => {
      const h = Math.max(4, (Math.sin(i * 0.8) * 0.5 + 0.5) * 28 * level + 4);
      return (
        <motion.div key={i}
          className="w-1 rounded-full"
          style={{ background: color }}
          animate={{ height: [4, h, 4] }}
          transition={{ duration: 0.4, delay: i * 0.05, repeat: Infinity, ease: "easeInOut" }}
        />
      );
    })}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [emotion, setEmotion]         = useState<Emotion>("neutral");
  const [transcript, setTranscript]   = useState("");
  const [response, setResponse]       = useState<VoiceQueryResponse | null>(null);
  const [recordingState, setRS]       = useState<RecordingState>("idle");
  const [apiError, setApiError]       = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [online, setOnline]           = useState<boolean | null>(null);
  const [autoSpeak, setAutoSpeak]     = useState(true);
  const [wakeOn, setWakeOn]           = useState(false);
  const [showChat, setShowChat]       = useState(false);
  const [emojiBurst, setEmojiBurst]   = useState(0);
  const [lang, setLang]               = useState<"english" | "nepali">("english");
  const [greeting]                    = useState(() =>
    GREETING_MESSAGES[Math.floor(Math.random() * GREETING_MESSAGES.length)]);

  const busyRef  = useRef(false);
  const recorder = useAudioRecorder();
  const { speak, cancel: cancelTTS } = useTTS();
  const conversation = useConversation();
  const settings: Settings = { language: lang, voice: "female", autoSpeak, darkMode: true };

  const cfg = EMOTION_CONFIG[emotion] ?? EMOTION_CONFIG.neutral;

  useEffect(() => { checkHealth().then(setOnline); }, []);

  // ── Process ───────────────────────────────────────────────────────────────
  const processAudio = useCallback(async (blob: Blob) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRS("processing");
    setEmotion("thinking");
    cancelTTS();
    try {
      const result = await sendVoiceQuery(blob);
      setTranscript(result.transcript);
      setResponse(result);
      setEmotion(result.emotion as Emotion);
      conversation.addUserMessage(result.transcript);
      conversation.addAssistantMessage(result);
      setEmojiBurst(b => b + 1);

      if (autoSpeak && result.response) {
        setRS("speaking");
        setIsSpeaking(true);
        speak(result.response, result.emotion, settings,
          () => setIsSpeaking(true),
          () => { setIsSpeaking(false); setEmotion(result.emotion as Emotion); setRS("idle"); }
        );
      } else {
        setRS("idle");
      }
    } catch (err) {
      const msg = err instanceof APIError ? err.message : "Oops! Try again 😢";
      setApiError(msg);
      setEmotion("sad");
      setRS("error");
      setTimeout(() => { setApiError(null); setRS("idle"); setEmotion("neutral"); }, 3000);
    } finally {
      busyRef.current = false;
    }
  }, [autoSpeak, settings, speak, cancelTTS, conversation]);

  const handleMic = useCallback(async () => {
    if (busyRef.current) return;
    setApiError(null);
    if (recorder.recordingState === "recording") {
      const blob = await recorder.stopRecording();
      if (!blob || blob.size < 800) {
        setApiError("Too short — hold and speak! 🎤");
        setRS("error");
        setTimeout(() => { setApiError(null); setRS("idle"); }, 2500);
        return;
      }
      await processAudio(blob);
    } else {
      setTranscript(""); setResponse(null); setEmotion("neutral");
      await recorder.startRecording();
      setRS("recording");
    }
  }, [recorder, processAudio]);

  useEffect(() => {
    if (recorder.recordingState === "requesting") setRS("requesting");
    if (recorder.recordingState === "recording")  setRS("recording");
    if (recorder.recordingState === "error") { setApiError(recorder.error); setRS("error"); }
  }, [recorder.recordingState, recorder.error]);

  const { supported: wakeOk, listening: wakeListen } = useWakeWord({
    onDetected: () => { if (recordingState === "idle" && online) handleMic(); },
    enabled: wakeOn && recordingState === "idle",
    keywords: ["monto", "hey monto", "hi monto", "मन्टो", "हे मन्टो"],
    language: lang === "nepali" ? "ne-NP" : "en-US",
  });

  const isRec    = recordingState === "recording";
  const isProc   = recordingState === "processing" || recordingState === "requesting";
  const isBusy   = isRec || isProc || isSpeaking;

  // Status text
  const statusText = useMemo(() => {
    if (apiError) return apiError;
    if (recordingState === "recording")  return "🔴 Listening... tap to stop";
    if (recordingState === "processing") return "💭 Thinking...";
    if (recordingState === "speaking")   return "🔊 Monto is speaking...";
    if (wakeOn && wakeListen)            return "👂 Listening for 'Monto'...";
    if (wakeOn)                          return "Wake word active";
    return "Tap mic or say 'Monto'";
  }, [recordingState, apiError, wakeOn, wakeListen]);

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden select-none"
         style={{ background: `linear-gradient(160deg, #0D0820 0%, #180D3A 45%, #0A1428 100%)` }}>

      <StarField />
      <EmojiBurst emotion={emotion} trigger={emojiBurst} />

      {/* Emotion ambient glow */}
      <motion.div className="fixed inset-0 pointer-events-none"
        animate={{ opacity: [0.08, 0.14, 0.08] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: `radial-gradient(ellipse 60% 50% at 50% 40%, ${cfg.glow}55, transparent)` }}
      />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between px-5 pt-safe pt-4 pb-2">
        {/* Status pill */}
        <motion.div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass glass-border"
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <motion.div
            className={cn("w-1.5 h-1.5 rounded-full", online ? "bg-emerald-400" : "bg-red-400")}
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-[10px] text-white/50 font-semibold tracking-wide">
            {online ? "ONLINE" : "OFFLINE"}
          </span>
        </motion.div>

        {/* Brand */}
        <motion.div className="text-center" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="font-kids text-3xl text-shimmer leading-none">MONTO</div>
          <div className="text-[9px] tracking-[0.3em] text-white/40 uppercase mt-0.5">Kids · AI Sathi ✦</div>
        </motion.div>

        {/* Chat toggle */}
        <motion.button
          onClick={() => setShowChat(v => !v)}
          className="w-9 h-9 rounded-full glass glass-border flex items-center justify-center"
          whileTap={{ scale: 0.85 }}
          initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
        >
          {showChat
            ? <X className="w-4 h-4 text-white/70" />
            : <MessageCircle className="w-4 h-4 text-white/70" />}
        </motion.button>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-5 pb-safe pb-6 max-w-md mx-auto w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {!showChat ? (
            <motion.div key="voice" className="flex flex-col items-center w-full flex-1"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* ── Avatar area ──────────────────────────────────────── */}
              <div className="relative flex items-center justify-center mt-2 mb-2">
                {/* Outer orbit ring */}
                <motion.div className="absolute rounded-full border"
                  style={{
                    width: 250, height: 250,
                    borderColor: `${cfg.color}25`,
                    boxShadow: `0 0 60px ${cfg.glow}20`,
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  {/* Orbit dots */}
                  {[0, 90, 180, 270].map((deg, i) => (
                    <div key={i} className="absolute w-2 h-2 rounded-full"
                         style={{
                           background: cfg.color,
                           top: "50%", left: "50%",
                           transform: `rotate(${deg}deg) translateX(123px) translateY(-50%)`,
                           opacity: 0.6,
                         }} />
                  ))}
                </motion.div>

                {/* Inner glow */}
                <motion.div className="absolute rounded-full"
                  style={{ width: 200, height: 200, background: `radial-gradient(circle, ${cfg.glow}30, transparent)` }}
                  animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* Avatar */}
                <motion.div
                  className="float relative z-10"
                  animate={isRec ? { scale: [1, 1.03, 1] } : {}}
                  transition={{ duration: 0.3, repeat: Infinity }}
                >
                  <Avatar emotion={emotion} size={190} />
                </motion.div>

                {/* Speaking arcs */}
                <AnimatePresence>
                  {isSpeaking && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                      {[0,1,2].map(i => (
                        <motion.div key={i}
                          className="absolute rounded-full border-2"
                          style={{ borderColor: cfg.color + "70", right: -4 - i * 14, top: "50%", transform: "translateY(-50%)" }}
                          initial={{ width: 16, height: 16, opacity: 0.9 }}
                          animate={{ width: 16 + i * 18, height: 16 + i * 18, opacity: 0 }}
                          transition={{ duration: 1, delay: i * 0.25, repeat: Infinity }}
                        />
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Status / greeting ────────────────────────────────── */}
              <motion.div className="text-center mb-3 px-4" layout>
                <AnimatePresence mode="wait">
                  <motion.p key={statusText}
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      apiError ? "text-red-300" :
                      isRec ? "text-red-300" :
                      isProc ? "text-purple-300" :
                      isSpeaking ? "text-yellow-300" :
                      "text-white/50"
                    )}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
                  >
                    {statusText}
                  </motion.p>
                </AnimatePresence>
              </motion.div>

              {/* ── Audio visualizer ─────────────────────────────────── */}
              <AnimatePresence>
                {isRec && (
                  <motion.div className="mb-3"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}>
                    <AudioBars level={recorder.audioLevel} color={cfg.color} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Response card ─────────────────────────────────────── */}
              <div className="w-full flex-1 flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {response ? (
                    <motion.div key="response"
                      className="w-full rounded-3xl p-4 relative overflow-hidden glass glass-border"
                      style={{ borderColor: `${cfg.color}30` }}
                      initial={{ opacity: 0, y: 24, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -16, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                      {/* Animated top edge */}
                      <motion.div className="absolute top-0 left-0 right-0 h-0.5"
                        style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}, ${cfg.glow}, transparent)` }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />

                      {/* You said */}
                      {transcript && (
                        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/10">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                               style={{ background: `${cfg.color}30` }}>
                            <Mic className="w-2.5 h-2.5" style={{ color: cfg.color }} />
                          </div>
                          <p className="text-white/50 text-xs leading-snug">{transcript}</p>
                        </div>
                      )}

                      {/* Monto reply */}
                      <div className="flex items-start gap-2.5">
                        <motion.div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.glow})` }}
                          animate={isSpeaking ? { scale: [1, 1.2, 1] } : {}}
                          transition={{ duration: 0.5, repeat: Infinity }}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                        </motion.div>
                        <div className="flex-1">
                          <p className="text-[11px] font-bold mb-1 uppercase tracking-wider"
                             style={{ color: cfg.color }}>Monto</p>
                          <p className="text-white text-sm leading-relaxed font-medium">
                            {response.response}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="greeting"
                      className="w-full rounded-3xl p-4 glass glass-border text-center"
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}>
                      <p className="text-white/40 text-sm leading-relaxed">{greeting}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Controls ──────────────────────────────────────────── */}
              <div className="flex flex-col items-center gap-4 mt-5 w-full">
                {/* Mic button */}
                <div className="relative flex items-center justify-center">
                  {/* Pulse rings */}
                  <AnimatePresence>
                    {isRec && [0,1,2].map(i => (
                      <motion.div key={i}
                        className="absolute rounded-full"
                        style={{ border: `2px solid ${cfg.color}` }}
                        initial={{ width: 88, height: 88, opacity: 0.7 }}
                        animate={{ width: 88 + i*36 + recorder.audioLevel*24, height: 88 + i*36 + recorder.audioLevel*24, opacity: 0 }}
                        transition={{ duration: 1.4, delay: i * 0.35, repeat: Infinity, ease: "easeOut" }}
                      />
                    ))}
                  </AnimatePresence>

                  {/* Button */}
                  <motion.button
                    onClick={handleMic}
                    disabled={!online || isProc}
                    className="relative z-10 w-22 h-22 rounded-full flex items-center justify-center focus:outline-none disabled:opacity-40"
                    style={{
                      width: 88, height: 88,
                      background: isRec
                        ? `linear-gradient(135deg, #EF4444, #DC2626)`
                        : `linear-gradient(135deg, ${cfg.color}, ${cfg.glow})`,
                      boxShadow: isRec
                        ? "0 0 40px rgba(239,68,68,0.5), 0 8px 32px rgba(0,0,0,0.4)"
                        : `0 0 40px ${cfg.glow}50, 0 8px 32px rgba(0,0,0,0.4)`,
                    }}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <AnimatePresence mode="wait">
                      {isProc ? (
                        <motion.div key="spin" animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                          <Sparkles className="w-10 h-10 text-white" />
                        </motion.div>
                      ) : isRec ? (
                        <motion.div key="stop"
                          initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 400 }}>
                          <div className="w-8 h-8 rounded-lg bg-white" />
                        </motion.div>
                      ) : (
                        <motion.div key="mic"
                          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 400 }}>
                          <Mic className="w-10 h-10 text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>

                {/* Bottom row */}
                <div className="flex items-center gap-3">
                  {/* Volume */}
                  <motion.button onClick={() => setAutoSpeak(v => !v)}
                    className="w-11 h-11 rounded-2xl glass glass-border flex items-center justify-center"
                    whileTap={{ scale: 0.85 }}>
                    {autoSpeak
                      ? <Volume2 className="w-4 h-4" style={{ color: cfg.color }} />
                      : <VolumeX className="w-4 h-4 text-white/30" />}
                  </motion.button>

                  {/* Language toggle EN/NE */}
                  <motion.button
                    onClick={() => setLang(l => l === "english" ? "nepali" : "english")}
                    className="h-11 px-3 rounded-2xl glass glass-border flex items-center gap-1.5 font-bold text-xs"
                    style={{ color: lang === "nepali" ? "#F472B6" : cfg.color }}
                    whileTap={{ scale: 0.85 }}
                  >
                    <span className="text-sm">{lang === "nepali" ? "🇳🇵" : "🇺🇸"}</span>
                    <span>{lang === "nepali" ? "नेपाली" : "EN"}</span>
                  </motion.button>

                  {/* Wake word */}
                  {wakeOk && (
                    <motion.button onClick={() => setWakeOn(v => !v)}
                      className="h-11 px-4 rounded-2xl flex items-center gap-2 font-bold text-xs"
                      style={{
                        background: wakeOn ? `${cfg.color}25` : "rgba(255,255,255,0.06)",
                        border: `1px solid ${wakeOn ? cfg.color + "60" : "rgba(255,255,255,0.12)"}`,
                        color: wakeOn ? cfg.color : "rgba(255,255,255,0.4)",
                      }}
                      whileTap={{ scale: 0.9 }}>
                      <motion.div className="w-2 h-2 rounded-full"
                        style={{ background: wakeOn && wakeListen ? cfg.color : "rgba(255,255,255,0.2)" }}
                        animate={wakeOn && wakeListen ? { scale: [1, 1.6, 1] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      {wakeOn ? (wakeListen ? "Listening..." : "Wake On") : "Say Monto"}
                    </motion.button>
                  )}

                  {/* New chat */}
                  <motion.button
                    onClick={() => { conversation.clearHistory(); setTranscript(""); setResponse(null); setEmotion("neutral"); }}
                    className="w-11 h-11 rounded-2xl glass glass-border flex items-center justify-center"
                    whileTap={{ scale: 0.85 }}>
                    <ChevronRight className="w-4 h-4 text-white/40 rotate-180" />
                  </motion.button>
                </div>
              </div>
            </motion.div>

          ) : (
            /* ── Chat view ──────────────────────────────────────────── */
            <motion.div key="chat" className="flex flex-col w-full flex-1 overflow-hidden"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 py-3 px-1">
                {conversation.messages.length === 0 && (
                  <div className="text-center text-white/30 text-sm mt-8">{greeting}</div>
                )}
                <AnimatePresence initial={false}>
                  {conversation.messages.map((msg) => {
                    const isUser = msg.role === "user";
                    const mCfg = EMOTION_CONFIG[(msg.emotion ?? "neutral") as keyof typeof EMOTION_CONFIG] ?? EMOTION_CONFIG.neutral;
                    return (
                      <motion.div key={msg.id}
                        className={cn("flex", isUser ? "justify-end" : "justify-start")}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}>
                        {!isUser && (
                          <div className="w-7 h-7 rounded-full mr-2 flex-shrink-0 mt-1 flex items-center justify-center"
                               style={{ background: `linear-gradient(135deg, ${mCfg.color}, ${mCfg.glow})` }}>
                            <Sparkles className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className={cn("max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed font-medium")}
                             style={isUser
                               ? { background: `linear-gradient(135deg, #7C3AED, #EC4899)`, color: "white", borderBottomRightRadius: 6 }
                               : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "white", borderBottomLeftRadius: 6 }}>
                          {msg.text}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Chat mic */}
              <div className="pt-3 flex items-center justify-center gap-3">
                <motion.button onClick={handleMic}
                  disabled={!online || isProc}
                  className="w-16 h-16 rounded-full flex items-center justify-center focus:outline-none disabled:opacity-40"
                  style={{
                    background: isRec
                      ? "linear-gradient(135deg, #EF4444, #DC2626)"
                      : `linear-gradient(135deg, ${cfg.color}, ${cfg.glow})`,
                    boxShadow: `0 0 30px ${cfg.glow}50`,
                  }}
                  whileTap={{ scale: 0.9 }}>
                  {isProc ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="w-7 h-7 text-white" /></motion.div>
                  : isRec ? <div className="w-5 h-5 rounded bg-white" />
                  : <Mic className="w-7 h-7 text-white" />}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
