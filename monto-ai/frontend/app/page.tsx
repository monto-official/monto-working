"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Mic, Sparkles, MessageCircle, X, ChevronRight, Settings as SettingsIcon } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { HangingAvatar } from "@/components/HangingAvatar";
import { CallScreen } from "@/components/CallScreen";
import { SettingsModal } from "@/components/SettingsModal";
import { SpiderWebOverlay } from "@/components/SpiderWebOverlay";
import { ExplorePanel, detectExploreScene, isExploreIntent, type ExploreScene } from "@/components/ExplorePanel";
import { PairingQRModal } from "@/components/PairingQRModal";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useTTS } from "@/hooks/useTTS";
import { useConversation } from "@/hooks/useConversation";
import { useWakeWord } from "@/hooks/useWakeWord";
import { sendVoiceQuery, checkHealth, APIError } from "@/lib/api";
import { Emotion, RecordingState, Settings, VoiceQueryResponse, Character } from "@/types";
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
  const [showChat, setShowChat]       = useState(false);
  const [emojiBurst, setEmojiBurst]   = useState(0);
  const [lang, setLang]               = useState<"english" | "nepali">("english");
  const [character, setCharacter]     = useState<Character>("spiderman");
  const [showSettings, setShowSettings] = useState(false);
  const [greeting, setGreeting] = useState(GREETING_MESSAGES[0]);

  useEffect(() => {
    // Pick random greeting client-side only — avoids hydration mismatch
    setGreeting(GREETING_MESSAGES[Math.floor(Math.random() * GREETING_MESSAGES.length)]);
  }, []);

  // ── Call state ─────────────────────────────────────────────────────────
  const [calling, setCalling]         = useState<"mom" | "dad" | null>(null);

  // ── Pairing QR modal ────────────────────────────────────────────────────
  const [showPairing, setShowPairing] = useState(false);

  // ── Explore mode ────────────────────────────────────────────────────────
  const [exploreScene, setExploreScene] = useState<ExploreScene>(null);
  const [exploreTranscript, setExploreTranscript] = useState("");

  // ── Water reminder ─────────────────────────────────────────────────────
  const [showWater, setShowWater]     = useState(false);
  const waterTimerRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  const busyRef          = useRef(false);
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpokenRef     = useRef(false);
  const recordingStateRef = useRef<RecordingState>("idle");
  const router           = useRouter();
  const recorder = useAudioRecorder();
  const { speak, cancel: cancelTTS } = useTTS();
  const conversation = useConversation();
  const settings: Settings = { language: lang, voice: "female", character, autoSpeak, darkMode: true };

  const handleSettingsChange = (s: Partial<Settings>) => {
    if (s.language !== undefined) setLang(s.language);
    if (s.character !== undefined) setCharacter(s.character);
    if (s.autoSpeak !== undefined) setAutoSpeak(s.autoSpeak);
  };

  const cfg = EMOTION_CONFIG[emotion] ?? EMOTION_CONFIG.neutral;

  useEffect(() => { checkHealth().then(setOnline); }, []);

  // ── Water reminder every 30 minutes ──────────────────────────────────────
  useEffect(() => {
    const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
    const waterMessages = [
      "Hey! 💧 Time to drink some water! Staying hydrated keeps you super strong!",
      "Water break time! 💦 Drink a glass of water — your body will thank you!",
      "Hey friend! 🥤 It's been a while — go grab some water right now!",
      "Hydration check! 💧 A healthy hero always drinks water. Go drink some!",
      "Water time! 🌊 Even Spider-Man drinks water to stay strong. Your turn!",
    ];

    waterTimerRef.current = setInterval(() => {
      const msg = waterMessages[Math.floor(Math.random() * waterMessages.length)];
      setShowWater(true);
      // Speak it out loud
      speak(msg, "happy", { language: "english", voice: "female", autoSpeak: true, darkMode: true },
        () => {},
        () => {}
      );
      // Hide card after 12 seconds
      setTimeout(() => setShowWater(false), 12000);
    }, INTERVAL_MS);

    return () => {
      if (waterTimerRef.current) clearInterval(waterTimerRef.current);
    };
  }, [speak]);

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

      // ── Call detection ──────────────────────────────────────────────────
      const lower = result.transcript.toLowerCase();
      const callMom = /call\s+(mom|mum|mama|mother|मम्मी|आमा)/i.test(lower);
      const callDad = /call\s+(dad|daddy|papa|father|बुबा|बाबा)/i.test(lower);
      if (callMom) { setRS("idle"); busyRef.current = false; setCalling("mom"); return; }
      if (callDad) { setRS("idle"); busyRef.current = false; setCalling("dad"); return; }

      // ── Media detection ─────────────────────────────────────────────────
      const playSongs   = /play\s+(song|songs|music|tune)/i.test(lower);
      const playStories = /play\s+(story|stories|bedtime|tale)/i.test(lower);
      const doYoga      = /(do|start|let'?s do)\s+yoga|yoga\s+time/i.test(lower);
      if (playSongs)   { setRS("idle"); busyRef.current = false; router.push("/songs");   return; }
      if (playStories) { setRS("idle"); busyRef.current = false; router.push("/stories"); return; }
      if (doYoga)      { setRS("idle"); busyRef.current = false; router.push("/yoga");    return; }

      // ── Explore mode detection ──────────────────────────────────────────
      const scene = detectExploreScene(result.transcript);
      if (scene) {
        setExploreScene(scene);
        setExploreTranscript(result.transcript);
        setRS("idle");
        busyRef.current = false;
        // Also speak the first narration via Monto
        if (autoSpeak && result.response) {
          speak(result.response, result.emotion, settings, () => {}, () => { setIsSpeaking(false); setRS("idle"); });
        }
        return;
      }

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

  // ── Silence detection — auto-stop after 1.5s of silence post-speech ────────
  useEffect(() => {
    if (recordingState !== "recording") {
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      hasSpokenRef.current = false;
      return;
    }
    const level = recorder.audioLevel;
    const SPEECH_THRESHOLD = 0.08;
    const SILENCE_MS       = 1500;

    if (level > SPEECH_THRESHOLD) {
      hasSpokenRef.current = true;
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    } else if (hasSpokenRef.current && !silenceTimerRef.current) {
      silenceTimerRef.current = setTimeout(async () => {
        silenceTimerRef.current = null;
        if (recorder.recordingState === "recording") {
          const blob = await recorder.stopRecording();
          if (blob && blob.size >= 800) {
            await processAudio(blob);
          } else {
            setRS("idle");
          }
        }
      }, SILENCE_MS);
    }
  }, [recorder.audioLevel, recorder.recordingState, recordingState, recorder, processAudio]);

  // Use a ref for handleMic so the wake word callback never goes stale
  const handleMicRef = useRef<() => Promise<void>>(async () => {});

  const handleMic = useCallback(async () => {    if (busyRef.current) return;
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

  // Keep ref in sync so wake word always calls latest handleMic
  useEffect(() => { handleMicRef.current = handleMic; }, [handleMic]);

  useEffect(() => {
    if (recorder.recordingState === "requesting") setRS("requesting");
    if (recorder.recordingState === "recording")  setRS("recording");
    if (recorder.recordingState === "error") { setApiError(recorder.error); setRS("error"); }
  }, [recorder.recordingState, recorder.error]);

  // Keep recordingStateRef current so wake word callback reads live value
  useEffect(() => { recordingStateRef.current = recordingState; }, [recordingState]);

  const { listening: wakeListen } = useWakeWord({
    onDetected: () => {
      console.log("[page] wake detected, state:", recordingStateRef.current, "online:", online);
      if (recordingStateRef.current === "idle" && online !== false) {
        handleMicRef.current();
      }
    },
    enabled: recordingState === "idle" && !isSpeaking && online !== false && !exploreScene,
    keywords: ["monto", "hey monto", "hi monto", "montu", "hey montu", "hi montu", "मन्टो", "हे मन्टो"],
    language: lang === "nepali" ? "ne-NP" : "en-US",
  });

  const isRec    = recordingState === "recording";
  const isProc   = recordingState === "processing" || recordingState === "requesting";

  // Status text
  const statusText = useMemo(() => {
    if (apiError) return apiError;
    if (recordingState === "recording")  return "🔴 Listening... speak now";
    if (recordingState === "processing") return "💭 Thinking...";
    if (recordingState === "speaking")   return "🔊 Monto is speaking...";
    if (wakeListen)                      return "👂 Say \"Hey Monto\" to start";
    return "Tap anywhere, then say \"Hey Monto\"";
  }, [recordingState, apiError, wakeListen]);

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden select-none bg-black">

      <EmojiBurst emotion={emotion} trigger={emojiBurst} />

      {/* ── Spider web overlay ───────────────────────────────────────────── */}
      <SpiderWebOverlay isListening={isRec} isSpeaking={isSpeaking} />

      {/* ── Explore Mode Panel ───────────────────────────────────────────── */}
      <ExplorePanel
        scene={exploreScene}
        transcript={exploreTranscript}
        onClose={() => { setExploreScene(null); setIsSpeaking(false); cancelTTS(); }}
        onNarrate={(text, onDone) => {
          // Cancel any previous speech first, then speak new step
          cancelTTS();
          speak(
            text,
            "excited",
            { language: lang, voice: "female", autoSpeak: true, darkMode: true },
            () => setIsSpeaking(true),
            () => { setIsSpeaking(false); onDone(); }, // advance step after speech ends
          );
        }}
        isSpeaking={isSpeaking}
      />

      {/* ── Calling overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {calling && (
          <CallScreen
            callee={calling}
            onEnd={() => setCalling(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Water reminder toast ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showWater && (
          <motion.div
            className="fixed top-6 left-1/2 z-40 w-[90vw] max-w-sm -translate-x-1/2"
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0,   scale: 1   }}
            exit={{   opacity: 0, y: -30,  scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            <div className="rounded-3xl px-5 py-4 flex items-center gap-4"
              style={{
                background: "linear-gradient(135deg, #0EA5E9, #38BDF8, #7DD3FC)",
                boxShadow: "0 0 40px rgba(14,165,233,0.5), 0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              {/* Animated water drop */}
              <motion.div
                className="text-4xl flex-shrink-0"
                animate={{ y: [0, -6, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              >
                💧
              </motion.div>

              <div className="flex-1">
                <p className="text-white font-bold text-sm leading-snug">
                  Time to drink water!
                </p>
                <p className="text-white/80 text-xs mt-0.5">
                  Stay hydrated — your body needs it! 🌊
                </p>
              </div>

              {/* Close button */}
              <motion.button
                onClick={() => setShowWater(false)}
                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"
                whileTap={{ scale: 0.85 }}
              >
                <X className="w-3.5 h-3.5 text-white" />
              </motion.button>
            </div>

            {/* Progress bar — drains over 12s */}
            <motion.div
              className="h-1 rounded-full mt-1.5 mx-1"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 12, ease: "linear" }}
              style={{ transformOrigin: "left", background: "rgba(255,255,255,0.6)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

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

        {/* Right side: Settings + Chat toggle */}
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-full glass glass-border flex items-center justify-center"
            whileTap={{ scale: 0.85 }}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            aria-label="Open settings"
          >
            <SettingsIcon className="w-4 h-4 text-white/70" />
          </motion.button>
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
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-5 pb-safe pb-6 max-w-md mx-auto w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {!showChat ? (
            <motion.div key="voice" className="flex flex-col items-center w-full flex-1"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* ── Avatar area ──────────────────────────────────────── */}
              <div className="relative flex items-center justify-center mt-2 mb-2">
                <motion.div
                  className="relative z-10"
                  animate={isRec ? { scale: [1, 1.03, 1] } : {}}
                  transition={{ duration: 0.3, repeat: Infinity }}
                >
                  <HangingAvatar
                    emotion={isSpeaking ? "talking" : emotion}
                    character={character}
                    size={220}
                    isListening={isRec}
                    isSpeaking={isSpeaking}
                  />
                </motion.div>
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

      {/* ── Settings Modal ───────────────────────────────────────────── */}
      <SettingsModal
        isOpen={showSettings}
        settings={settings}
        onClose={() => setShowSettings(false)}
        onChange={handleSettingsChange}
      />
    </div>
  );
}
