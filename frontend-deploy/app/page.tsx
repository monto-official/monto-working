"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Mic, MicOff, Sparkles, MessageCircle, X, ChevronLeft, ChevronRight, QrCode, Settings as SettingsIcon, CheckCircle2, Music2, BookOpen, PersonStanding, Compass, Snowflake, Gamepad2, HeartHandshake } from "lucide-react";
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
import { useAppControls } from "@/hooks/useAppControls";
import { useReminderPolling, type Reminder } from "@/hooks/useReminderPolling";
import { useDeviceChannelContext } from "@/components/DeviceChannelProvider";
import { sendVoiceQuery, checkHealth, APIError } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { loadChildName, saveChildName } from "@/lib/child-profile";
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
  const [micMuted, setMicMuted]       = useState(false);
  const [showChat, setShowChat]       = useState(false);
  const [emojiBurst, setEmojiBurst]   = useState(0);
  const [lang, setLang]               = useState<"english" | "nepali">("english");
  const [character, setCharacter]     = useState<Character>("spiderman");
  const [showSettings, setShowSettings] = useState(false);
  const [greeting, setGreeting] = useState(GREETING_MESSAGES[0]);
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    // Pick random greeting client-side only — avoids hydration mismatch
    setGreeting(GREETING_MESSAGES[Math.floor(Math.random() * GREETING_MESSAGES.length)]);
  }, []);

  useEffect(() => {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const isLowPower = /Raspberry Pi|armv|aarch64/i.test(navigator.userAgent) || (memory !== undefined && memory <= 4);
    setLowPower(isLowPower);
    document.documentElement.dataset.lowPower = isLowPower ? "true" : "false";
    return () => { delete document.documentElement.dataset.lowPower; };
  }, []);
  // ── Call state ─────────────────────────────────────────────────────────
  // isIncoming = the parent rang in (over the control channel below) rather
  // than the child triggering "call mom"/"call dad" by voice.
  const [calling, setCalling] = useState<{ callee: string; isIncoming: boolean } | null>(null);

  // ── Pairing QR modal ────────────────────────────────────────────────────
  const [showPairing, setShowPairing] = useState(false);

  // ── Explore mode ────────────────────────────────────────────────────────
  const [exploreScene, setExploreScene] = useState<ExploreScene>(null);
  const [exploreTranscript, setExploreTranscript] = useState("");

  // ── Water reminder ─────────────────────────────────────────────────────
  const [showWater, setShowWater]     = useState(false);
  const waterTimerRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Parent-set reminders (polled from the backend) ─────────────────────
  const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);
  const [deviceId] = useState(() => getOrCreateDeviceId());

  // ── Child name — set remotely by the parent app right after pairing ────
  const [childName, setChildName] = useState("");
  const [showPaired, setShowPaired] = useState(false);
  useEffect(() => { setChildName(loadChildName()); }, []);

  const busyRef          = useRef(false);
  const adventureSliderRef = useRef<HTMLDivElement | null>(null);
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpokenRef     = useRef(false);
  const recordingStateRef = useRef<RecordingState>("idle");
  const router           = useRouter();
  const recorder = useAudioRecorder();
  const { speak, cancel: cancelTTS } = useTTS();
  const conversation = useConversation();
  const settings: Settings = { language: lang, voice: "female", character, autoSpeak, darkMode: true };
  const controlDocument = useAppControls();
  const appControls = controlDocument?.controls;

  useEffect(() => {
    if (!appControls) return;
    setLang(appControls.default_language);
    setCharacter(appControls.default_character);
    setAutoSpeak(appControls.auto_speak);
  }, [controlDocument?.revision]);

  const handleSettingsChange = (s: Partial<Settings>) => {
    if (s.language !== undefined) setLang(s.language);
    if (s.character !== undefined) setCharacter(s.character);
    if (s.autoSpeak !== undefined) setAutoSpeak(s.autoSpeak);
  };

  const cfg = EMOTION_CONFIG[emotion] ?? EMOTION_CONFIG.neutral;

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refreshHealth = async () => {
      const value = await checkHealth();
      if (!active) return;
      setOnline(value);
      timer = setTimeout(refreshHealth, value ? 20000 : 5000);
    };
    void refreshHealth();
    return () => { active = false; clearTimeout(timer); };
  }, []);

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

  // ── Parent-set reminders — polled every 60s, fired via the same toast+speak
  // pattern as the water reminder above ───────────────────────────────────
  const handleReminderDue = useCallback((reminder: Reminder) => {
    setActiveReminder(reminder);
    speak(
      `Reminder! ${reminder.label}`,
      "happy",
      { language: "english", voice: "female", autoSpeak: true, darkMode: true },
      () => {},
      () => {}
    );
    setTimeout(() => setActiveReminder(null), 12000);
  }, [speak]);

  useReminderPolling(deviceId, handleReminderDue);

  // ── Music remote control — parent app can push a "play" command over the
  // always-on device control channel; navigate to /songs with that track ──
  const { lastMessage } = useDeviceChannelContext();
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "music-command" && lastMessage.action === "play" && lastMessage.trackId) {
      router.push(`/songs?track=${encodeURIComponent(lastMessage.trackId)}`);
    }
    if (lastMessage.type === "paired" && typeof lastMessage.childName === "string" && lastMessage.childName.trim()) {
      const name = lastMessage.childName.trim();
      saveChildName(name);
      setChildName(name);
      setShowPaired(true);
      setTimeout(() => setShowPaired(false), 6000);
    }
    if (lastMessage.type === "incoming-call" && !calling) {
      const callerName = typeof lastMessage.callerName === "string" && lastMessage.callerName.trim()
        ? lastMessage.callerName.trim() : "Your parent";
      speak(`${callerName} is calling!`, "excited",
        { language: "english", voice: "female", autoSpeak: true, darkMode: true },
        () => {}, () => {});
      setCalling({ callee: callerName, isIncoming: true });
    }
  }, [lastMessage, router, calling, speak]);

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
      if (appControls?.calls_enabled !== false && callMom) { setRS("idle"); busyRef.current = false; setCalling({ callee: "mom", isIncoming: false }); return; }
      if (appControls?.calls_enabled !== false && callDad) { setRS("idle"); busyRef.current = false; setCalling({ callee: "dad", isIncoming: false }); return; }

      // ── Media detection ─────────────────────────────────────────────────
      // Flexible intent matching: accepts "play a song", "play song",
      // "song play", "song chalao", and the same word-order variants for stories.
      const hasPlayIntent = /\b(play|start|listen|hear|chalao|chala do|bajao|baja do|sunao|suna do)\b/i.test(lower);
      const hasSongWord = /\b(song|songs|music|tune|gana|gaana|gane|gaane)\b/i.test(lower);
      const hasStoryIntent = /\b(play|start|tell|read|listen|hear|chalao|sunao|suna do)\b/i.test(lower);
      const hasStoryWord = /\b(story|stories|bedtime story|tale|kahani|kahaani|katha)\b/i.test(lower);
      const onlySongWord = /^(please\s+)?(a\s+)?(song|songs|music|tune|gana|gaana)(\s+please)?[.!?]*$/i.test(lower.trim());
      const onlyStoryWord = /^(please\s+)?(a\s+)?(story|stories|tale|kahani|kahaani|katha)(\s+please)?[.!?]*$/i.test(lower.trim());
      const playSongs = hasSongWord && (hasPlayIntent || onlySongWord);
      const playStories = hasStoryWord && (hasStoryIntent || onlyStoryWord);
      const doYoga      = /(do|start|let'?s do)\s+yoga|yoga\s+time/i.test(lower);
      if (appControls?.songs_enabled !== false && playSongs)   { setRS("idle"); busyRef.current = false; router.push("/songs");   return; }
      if (appControls?.stories_enabled !== false && playStories) { setRS("idle"); busyRef.current = false; router.push("/stories"); return; }
      if (appControls?.yoga_enabled !== false && doYoga)      { setRS("idle"); busyRef.current = false; router.push("/yoga");    return; }

      // ── Explore mode detection ──────────────────────────────────────────
      const scene = detectExploreScene(result.transcript);
      if (appControls?.explore_enabled !== false && scene) {
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
  }, [autoSpeak, settings, speak, cancelTTS, conversation, appControls, router]);

  // ── Silence detection — auto-stop after 1.5s of silence post-speech ────────
  useEffect(() => {
    if (recordingState !== "recording") {
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      hasSpokenRef.current = false;
      return;
    }
    const level = recorder.audioLevel;
    const SPEECH_THRESHOLD = 0.08;
    const SILENCE_MS       = 2200; // children often pause mid-sentence

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

  const handleMic = useCallback(async () => {
    if (micMuted) {
      setApiError("Microphone is muted. Turn it on to talk.");
      return;
    }
    if (appControls?.maintenance_mode || appControls?.ai_enabled === false || appControls?.microphone_enabled === false) {
      setApiError(appControls.admin_notice || "Voice features are disabled by the administrator.");
      return;
    }
    // Never grab the mic for a voice query while a call is using it.
    if (calling) return;
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
  }, [recorder, processAudio, calling, micMuted]);

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
      if (recordingStateRef.current === "idle") {
        handleMicRef.current();
      }
    },
    // Disabled during a call — the call already holds the mic via
    // getUserMedia for WebRTC, and a second concurrent mic grab from the
    // wake-word engine destabilizes the audio pipeline (and, on Android
    // WebView, was observed dropping the call's signaling WebSocket).
    enabled: !micMuted && recordingState === "idle" && !isSpeaking && !exploreScene && !calling,
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
    <div className="monto-home min-h-dvh flex flex-col relative overflow-hidden select-none">

      <div className="monto-aurora monto-aurora-one" aria-hidden="true" />
      <div className="monto-aurora monto-aurora-two" aria-hidden="true" />
      <div className="monto-noise" aria-hidden="true" />
      {!lowPower && <EmojiBurst emotion={emotion} trigger={emojiBurst} />}

      {/* ── Spider web overlay ───────────────────────────────────────────── */}
      {!lowPower && <SpiderWebOverlay isListening={isRec} isSpeaking={isSpeaking} />}

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
            callee={calling.callee}
            isIncoming={calling.isIncoming}
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

      {/* ── Pairing success toast ────────────────────────────────────────── */}
      <AnimatePresence>
        {showPaired && (
          <motion.div
            className="fixed top-6 left-1/2 z-40 w-[90vw] max-w-sm -translate-x-1/2"
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0,   scale: 1   }}
            exit={{   opacity: 0, y: -30,  scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            <div className="rounded-3xl px-5 py-4 flex items-center gap-4"
              style={{
                background: "linear-gradient(135deg, #10B981, #34D399, #6EE7B7)",
                boxShadow: "0 0 40px rgba(16,185,129,0.5), 0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              <motion.div
                className="flex-shrink-0"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <CheckCircle2 className="w-9 h-9 text-white" />
              </motion.div>

              <div className="flex-1">
                <p className="text-white font-bold text-sm leading-snug">
                  Paired successfully! 🎉
                </p>
                <p className="text-white/80 text-xs mt-0.5">
                  {childName ? `Hi ${childName}! Your parent's phone is now connected.` : "Your parent's phone is now connected."}
                </p>
              </div>

              <motion.button
                onClick={() => setShowPaired(false)}
                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"
                whileTap={{ scale: 0.85 }}
              >
                <X className="w-3.5 h-3.5 text-white" />
              </motion.button>
            </div>

            <motion.div
              className="h-1 rounded-full mt-1.5 mx-1"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 6, ease: "linear" }}
              style={{ transformOrigin: "left", background: "rgba(255,255,255,0.6)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Parent reminder toast ────────────────────────────────────────── */}
      <AnimatePresence>
        {activeReminder && (
          <motion.div
            className="fixed top-6 left-1/2 z-40 w-[90vw] max-w-sm -translate-x-1/2"
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0,   scale: 1   }}
            exit={{   opacity: 0, y: -30,  scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            <div className="rounded-3xl px-5 py-4 flex items-center gap-4"
              style={{
                background: "linear-gradient(135deg, #F59E0B, #FBBF24, #FDE68A)",
                boxShadow: "0 0 40px rgba(245,158,11,0.5), 0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              {/* Animated bell */}
              <motion.div
                className="text-4xl flex-shrink-0"
                animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              >
                🔔
              </motion.div>

              <div className="flex-1">
                <p className="text-white font-bold text-sm leading-snug">
                  Reminder!
                </p>
                <p className="text-white/80 text-xs mt-0.5">
                  {activeReminder.label}
                </p>
              </div>

              {/* Close button */}
              <motion.button
                onClick={() => setActiveReminder(null)}
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
      {appControls?.admin_notice && (
        <div className="relative z-30 mx-5 mt-2 rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-center text-xs font-semibold text-amber-100">
          {appControls.admin_notice}
        </div>
      )}
      {appControls?.maintenance_mode && (
        <div className="relative z-30 text-center text-[10px] uppercase tracking-widest text-amber-300">Maintenance mode</div>
      )}
      <header className="relative z-20 flex items-center justify-between w-full max-w-7xl mx-auto px-5 sm:px-7 pt-safe pt-5 pb-3">
        {/* Status pill */}
        <motion.div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass glass-border"
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <motion.div
            className={cn("w-1.5 h-1.5 rounded-full", online ? "bg-emerald-400" : "bg-amber-400")}
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-[10px] text-white/50 font-semibold tracking-wide">
            {online ? "READY" : "RECONNECTING"}
          </span>
        </motion.div>

        {/* Brand */}
        <motion.div className="text-center" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="font-kids text-3xl text-white leading-none monto-wordmark">MONTO</div>
          <div className="text-[9px] tracking-[0.3em] text-white/40 uppercase mt-0.5">Your little universe</div>
        </motion.div>

        {/* Right side: Settings + Chat toggle */}
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setShowPairing(true)}
            className="monto-icon-button"
            whileTap={{ scale: 0.85 }}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            aria-label="Pair with Parent App"
          >
            <QrCode className="w-4 h-4 text-white/70" />
          </motion.button>
          <motion.button
            onClick={() => setShowSettings(true)}
            className="monto-icon-button"
            whileTap={{ scale: 0.85 }}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            aria-label="Open settings"
          >
            <SettingsIcon className="w-4 h-4 text-white/70" />
          </motion.button>
          <motion.button
            onClick={() => setShowChat(v => !v)}
            className="monto-icon-button"
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
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 sm:px-6 lg:px-8 pb-safe pb-6 max-w-7xl mx-auto w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {!showChat ? (
            <motion.div key="voice" className="monto-stage monto-stage-dashboard grid grid-cols-1 lg:grid-cols-[minmax(300px,0.72fr)_minmax(520px,1.28fr)] items-stretch gap-3 sm:gap-5 w-full flex-1 rounded-[34px] p-3 sm:p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              <div className="monto-character-card rounded-[28px] p-5 flex flex-col items-center gap-3">
                <div className="relative flex items-center justify-center w-full">
                  <motion.div
                    className="relative z-10"
                    animate={isRec && !lowPower ? { scale: [1, 1.03, 1] } : {}}
                    transition={{ duration: 0.3, repeat: Infinity }}
                  >
                    <motion.div
                      className="monto-avatar-podium"
                      animate={isRec && !lowPower ? { scale: [1, 1.025, 1] } : { scale: 1 }}
                      transition={{ duration: 0.7, repeat: isRec && !lowPower ? Infinity : 0 }}
                    >
                      <Avatar emotion={isSpeaking ? "talking" : emotion} character={character} size={290} />
                    </motion.div>
                  </motion.div>
                </div>
                <div className="w-full flex flex-col items-center gap-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-sky-200/55 font-extrabold">Your friend</p>
                  <p className="font-kids text-3xl text-white">Monto</p>
                </div>
              </div>

              <div className="monto-console monto-main-console rounded-[28px] p-4 sm:p-6 flex flex-col gap-4 min-h-[480px]">
                <div className="monto-adventure-wrap">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-sky-200/50 font-extrabold">Pick an adventure</p>
                      <span className="monto-slide-guide">
                        Swipe adventures <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                      <div className="monto-slider-nav" aria-label="Adventure slider controls">
                        <button onClick={() => adventureSliderRef.current?.scrollBy({ left: -210, behavior: lowPower ? "auto" : "smooth" })} aria-label="Previous adventures">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button onClick={() => adventureSliderRef.current?.scrollBy({ left: 210, behavior: lowPower ? "auto" : "smooth" })} aria-label="Next adventures">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={() => {
                          if (!micMuted) recorder.cancelRecording();
                          setMicMuted(value => !value);
                          setApiError(null);
                        }}
                        aria-pressed={micMuted}
                        title={micMuted ? "Turn microphone on" : "Mute microphone"}
                        className={"flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-bold transition " + (micMuted ? "border-rose-400/40 bg-rose-500/20 text-rose-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200")}
                        whileTap={{ scale: .94 }}>
                        {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        <span>{micMuted ? "Mic muted" : "Mic on"}</span>
                      </motion.button>
                      <motion.button
                        onClick={() => {
                          if (autoSpeak) cancelTTS();
                          setAutoSpeak(value => !value);
                        }}
                        aria-pressed={!autoSpeak}
                        title={autoSpeak ? "Mute speaker" : "Turn speaker on"}
                        className={"flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-bold transition " + (autoSpeak ? "border-sky-400/30 bg-sky-400/10 text-sky-200" : "border-slate-400/20 bg-white/5 text-white/45")}
                        whileTap={{ scale: .94 }}>
                        {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                        <span>{autoSpeak ? "Speaker on" : "Speaker muted"}</span>
                      </motion.button>
                    </div>
                  </div>
                  <div ref={adventureSliderRef} className="monto-adventure-grid monto-adventure-slider">
                    {[
                      { label: "Music", icon: Music2, route: "/songs", tone: "coral", enabled: appControls?.songs_enabled !== false },
                      { label: "Stories", icon: BookOpen, route: "/stories", tone: "violet", enabled: appControls?.stories_enabled !== false },
                      { label: "Move", icon: PersonStanding, route: "/yoga", tone: "mint", enabled: appControls?.yoga_enabled !== false },
                      { label: "Games", icon: Gamepad2, route: "/games", tone: "sun", enabled: true },
                      { label: "Moral Game", icon: HeartHandshake, route: "/moral-game", tone: "rose", enabled: true },
                      { label: "Explore", icon: Compass, action: () => { setExploreScene("solar-system"); setExploreTranscript("solar system planets"); }, tone: "sky", enabled: true },
                    ].filter(item => item.enabled).map((item) => (
                      <motion.button key={item.label} onClick={() => item.action ? item.action() : item.route ? router.push(item.route) : handleMic()}
                        className={`monto-adventure monto-adventure-${item.tone}`} whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}>
                        <item.icon className="monto-adventure-icon" strokeWidth={2.3} />
                        <span>{item.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.32em] text-white/40">Status</p>
                      <p className={cn(
                        "text-sm font-semibold",
                        apiError ? "text-red-300" :
                        isRec ? "text-red-300" :
                        isProc ? "text-purple-300" :
                        isSpeaking ? "text-yellow-300" :
                        "text-white/70"
                      )}>
                        {statusText}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/40">
                      {lang === "nepali" ? "नेपाली" : "EN"}
                    </div>
                  </div>
                  {isRec && (
                    <motion.div className="overflow-hidden rounded-3xl border border-white/10 p-3"
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}>
                      <AudioBars level={recorder.audioLevel} color={cfg.color} />
                    </motion.div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-between gap-4">
                  <AnimatePresence mode="wait">
                    {response ? (
                      <motion.div key="response"
                        className="relative rounded-[28px] glass glass-border p-5 shadow-[0_24px_50px_rgba(0,0,0,0.25)]"
                        initial={{ opacity: 0, y: 24, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      >
                        <div className="absolute top-0 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-transparent via-[#6366f1] to-transparent opacity-80" />
                        {transcript && (
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                 style={{ background: `${cfg.color}20` }}>
                              <Mic className="w-3 h-3" style={{ color: cfg.color }} />
                            </div>
                            <p className="text-white/50 text-xs leading-snug">{transcript}</p>
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <motion.div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.glow})` }}
                            animate={isSpeaking ? { scale: [1, 1.12, 1] } : {}}
                            transition={{ duration: 0.5, repeat: Infinity }}
                          >
                            <Sparkles className="w-4 h-4 text-white" />
                          </motion.div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Monto reply</p>
                              <span className="text-[11px] uppercase tracking-[0.3em] text-white/30">Thought</span>
                            </div>
                            <p className="text-white text-sm leading-relaxed font-medium">
                              {response.response}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="greeting"
                        className="monto-greeting rounded-[28px] p-6 text-center"
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}>
                        <Sparkles className="w-5 h-5 text-amber-300 mx-auto mb-3" /><p className="text-white text-lg sm:text-xl font-extrabold leading-snug">{greeting}</p><p className="text-sky-100/50 text-xs mt-2">Ask a question, tell a joke, or start an adventure.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                  disabled={isProc || appControls?.maintenance_mode || appControls?.ai_enabled === false || appControls?.microphone_enabled === false}
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

      <AnimatePresence>
        {showPairing && (
          <PairingQRModal onClose={() => setShowPairing(false)} />
        )}
      </AnimatePresence>

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





