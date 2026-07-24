"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Mic, MicOff, Sparkles, MessageCircle, X, ChevronLeft, ChevronRight, QrCode, Settings as SettingsIcon, CheckCircle2, Music2, BookOpen, Dumbbell, Compass, Snowflake, Gamepad2, HeartHandshake, Voicemail } from "lucide-react";
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
import { getApiUrl } from "@/lib/api-url";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { loadChildName, saveChildName } from "@/lib/child-profile";
import { Emotion, RecordingState, Settings, VoiceQueryResponse, Character } from "@/types";
import { cn } from "@/lib/utils";

// ── Nepal flag (simplified double-pennant SVG) ─────────────────────────────────
function NepalFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 4 L96 30 L36 58 L96 92 L4 116 Z"
        fill="#DC143C"
        stroke="#003893"
        strokeWidth="7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Moon — upper pennant */}
      <circle cx="38" cy="21" r="7" fill="#ffffff" />
      <circle cx="42" cy="18.5" r="6" fill="#DC143C" />
      {/* Sun — lower pennant */}
      <g transform="translate(45 89)">
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x="-1" y="-11" width="2" height="5" fill="#ffffff" transform={`rotate(${i * 45})`} />
        ))}
        <circle r="6" fill="#ffffff" />
      </g>
    </svg>
  );
}

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
  const [calling, setCalling] = useState<{ callee: string; isIncoming: boolean; avatar?: string } | null>(null);

  // ── Pairing QR modal ────────────────────────────────────────────────────
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [showPairing, setShowPairing] = useState(false);
  const [parentConnection, setParentConnection] = useState({ loading: true, count: 0, error: false });

  const refreshParentConnection = useCallback(async () => {
    setParentConnection((current) => ({ ...current, loading: true, error: false }));
    try {
      const response = await fetch(`${getApiUrl()}/pairing/status/${encodeURIComponent(deviceId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parents = await response.json() as Array<{ parent_device_id: string }>;
      setParentConnection({ loading: false, count: parents.length, error: false });
    } catch {
      setParentConnection((current) => ({ ...current, loading: false, error: true }));
    }
  }, [deviceId]);

  useEffect(() => {
    if (showSettings) void refreshParentConnection();
  }, [showSettings, refreshParentConnection]);

  // ── Explore mode ────────────────────────────────────────────────────────
  const [exploreScene, setExploreScene] = useState<ExploreScene>(null);
  const [exploreTranscript, setExploreTranscript] = useState("");
  const [showExplorePicker, setShowExplorePicker] = useState(false);

  // ── Water reminder ─────────────────────────────────────────────────────
  const [showWater, setShowWater]     = useState(false);
  const waterTimerRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Parent-set reminders (polled from the backend) ─────────────────────
  const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);

  // ── Child name — set remotely by the parent app right after pairing ────
  const [childName, setChildName] = useState("");
  const [showPaired, setShowPaired] = useState(false);
  useEffect(() => { setChildName(loadChildName()); }, []);

  // ── Incoming voice note from the parent app ─────────────────────────────
  const [incomingVoiceNote, setIncomingVoiceNote] = useState(false);
  const voiceNoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const busyRef          = useRef(false);
  const adventureSliderRef = useRef<HTMLDivElement | null>(null);
  const ringtoneRef       = useRef<HTMLAudioElement | null>(null);
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
    new Audio("/sounds/reminder_ringtone.mp3").play().catch(() => {});
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
    if (lastMessage.type === "story-command" && lastMessage.action === "play" && lastMessage.trackId) {
      router.push(`/stories?track=${encodeURIComponent(lastMessage.trackId)}`);
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
      const ringtone = new Audio("/sounds/call_ringtone.mp3");
      ringtone.loop = true;
      ringtone.play().catch(() => {});
      ringtoneRef.current = ringtone;
      // Auto-answer happens almost immediately, so the ring window is brief
      // either way — cap it so the tone can't loop through the whole call
      // if something ever delays the connect.
      setTimeout(() => { ringtone.pause(); if (ringtoneRef.current === ringtone) ringtoneRef.current = null; }, 6000);
      speak(`${callerName} is calling!`, "excited",
        { language: "english", voice: "female", autoSpeak: true, darkMode: true },
        () => {}, () => {});
      const callerAvatar = typeof lastMessage.callerAvatar === "string" ? lastMessage.callerAvatar : undefined;
      setCalling({ callee: callerName, isIncoming: true, avatar: callerAvatar });
    }
    if (lastMessage.type === "voice-message" && lastMessage.senderRole === "parent" && typeof lastMessage.id === "string") {
      const messageId = lastMessage.id;
      setIncomingVoiceNote(true);
      setTimeout(() => setIncomingVoiceNote(false), 8000);
      fetch(`${getApiUrl()}/voice-messages/${deviceId}/${messageId}/audio`)
        .then(res => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          voiceNoteAudioRef.current = audio;
          audio.onended = () => URL.revokeObjectURL(url);
          void audio.play().catch(() => {});
        })
        .catch(() => {});
    }
  }, [lastMessage, router, calling, speak, deviceId]);

  // Stop any in-progress ringtone as soon as the call screen closes.
  useEffect(() => {
    if (calling) return;
    ringtoneRef.current?.pause();
    ringtoneRef.current = null;
  }, [calling]);

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

  // ── Adventure slider ─────────────────────────────────────────────────────
  const adventureItems = [
    { label: "Music", icon: Music2, route: "/songs", tone: "coral", enabled: appControls?.songs_enabled !== false },
    { label: "Stories", icon: BookOpen, route: "/stories", tone: "violet", enabled: appControls?.stories_enabled !== false },
    { label: "Exercise", icon: Dumbbell, route: "/exercise", tone: "mint", enabled: appControls?.yoga_enabled !== false },
    { label: "Games", icon: Gamepad2, route: "/games", tone: "sun", enabled: true },
    { label: "Moral Game", icon: HeartHandshake, route: "/moral-game", tone: "rose", enabled: true },
    { label: "Explore", icon: Compass, action: () => setShowExplorePicker(true), tone: "sky", enabled: true },
    { label: "Voice", icon: Voicemail, route: "/voice-messages", tone: "plum", enabled: true },
  ].filter(item => item.enabled);

  const [activeAdventure, setActiveAdventure] = useState(0);

  const handleSliderScroll = useCallback(() => {
    const el = adventureSliderRef.current;
    if (!el || !el.children.length) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const node = child as HTMLElement;
      const dist = Math.abs(node.offsetLeft + node.offsetWidth / 2 - center);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setActiveAdventure(closest);
  }, []);

  const scrollToAdventure = useCallback((index: number) => {
    const el = adventureSliderRef.current;
    const child = el?.children[index] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft - 8, behavior: lowPower ? "auto" : "smooth" });
  }, [lowPower]);

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

      {/* ── Explore topic picker ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showExplorePicker && (
          <motion.div
            className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowExplorePicker(false)} />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-3xl overflow-hidden p-5"
              style={{
                background: "linear-gradient(135deg, rgba(15,15,30,0.97) 0%, rgba(20,10,40,0.97) 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 0 80px rgba(99,102,241,0.3), 0 32px 64px rgba(0,0,0,0.6)",
              }}
              initial={{ y: 40, scale: 0.94, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 30, scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-white font-bold text-base">🔭 Pick something to explore</span>
                <button onClick={() => setShowExplorePicker(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white/70" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { scene: "solar-system" as const, label: "Solar System", emoji: "🪐", transcript: "solar system planets" },
                  { scene: "photosynthesis" as const, label: "Plants & Food", emoji: "🌿", transcript: "how plants make food" },
                  { scene: "animal-life" as const, label: "Animal Life", emoji: "🦋", transcript: "animal life cycle butterfly" },
                  { scene: "water-cycle" as const, label: "Water Cycle", emoji: "💧", transcript: "water cycle rain" },
                  { scene: "dinosaurs" as const, label: "Dinosaurs", emoji: "🦖", transcript: "dinosaurs" },
                  { scene: "ocean-life" as const, label: "Ocean Life", emoji: "🐋", transcript: "ocean sea creatures" },
                  { scene: "human-body" as const, label: "Your Body", emoji: "🧠", transcript: "human body" },
                  { scene: "know-nepal" as const, label: "Know Nepal", emoji: "🇳🇵", transcript: "know nepal history culture tradition geography wildlife" },
                ].map((topic) => (
                  <motion.button
                    key={topic.scene}
                    onClick={() => {
                      setExploreScene(topic.scene);
                      setExploreTranscript(topic.transcript);
                      setShowExplorePicker(false);
                    }}
                    whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}
                    className="rounded-2xl p-4 flex flex-col items-center gap-2 text-center text-white text-sm font-semibold"
                    style={{ background: "rgba(99,102,241,0.14)", border: "1px solid rgba(99,102,241,0.28)" }}
                  >
                    <span className="text-3xl">{topic.emoji}</span>
                    <span>{topic.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Calling overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {calling && (
          <CallScreen
            callee={calling.callee}
            isIncoming={calling.isIncoming}
            avatar={calling.avatar}
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

      {/* ── Incoming voice note toast ────────────────────────────────────── */}
      <AnimatePresence>
        {incomingVoiceNote && (
          <motion.div
            className="fixed top-6 left-1/2 z-40 w-[90vw] max-w-sm -translate-x-1/2"
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0,   scale: 1   }}
            exit={{   opacity: 0, y: -30,  scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            <div className="rounded-3xl px-5 py-4 flex items-center gap-4"
              style={{
                background: "linear-gradient(135deg, #7C3AED, #A855F7, #D8B4FE)",
                boxShadow: "0 0 40px rgba(124,58,237,0.5), 0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              <motion.div
                className="text-4xl flex-shrink-0"
                animate={{ rotate: [0, -8, 8, -8, 0] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              >
                💌
              </motion.div>

              <div className="flex-1">
                <p className="text-white font-bold text-sm leading-snug">
                  Voice message from your parent!
                </p>
                <p className="text-white/80 text-xs mt-0.5">
                  Playing it now — listen up! 🎧
                </p>
              </div>

              <motion.button
                onClick={() => setIncomingVoiceNote(false)}
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
              transition={{ duration: 8, ease: "linear" }}
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
          <div className="flex items-center justify-center gap-1.5">
            <div className="font-kids text-3xl text-white leading-none monto-wordmark">MONTO</div>
            <motion.div
              className="w-4 h-5 sm:w-5 sm:h-6"
              style={{ transformOrigin: "0% 100%" }}
              animate={{ rotate: [0, 16, -12, 16, -6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
            >
              <NepalFlag className="w-full h-full" />
            </motion.div>
          </div>
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

              <div className="monto-character-card rounded-[28px] p-4 sm:p-5 flex flex-col items-center">
                <div className="monto-companion-header">
                  <div>
                    <p className="monto-eyebrow">Your AI buddy</p>
                    <h2 className="font-kids text-2xl text-white">Meet Monto</h2>
                  </div>
                  <div className={cn("monto-live-pill", isRec && "is-listening", isSpeaking && "is-speaking")}>
                    <span />
                    {isRec ? "Listening" : isSpeaking ? "Talking" : "Ready"}
                  </div>
                </div>
                <div className="monto-avatar-stage relative flex items-center justify-center w-full">
                  <motion.div className="relative z-10 flex w-full justify-center" animate={isRec && !lowPower ? { scale: [1, 1.03, 1] } : {}} transition={{ duration: 0.3, repeat: Infinity }}>
                    <motion.div className="monto-avatar-podium flex w-full justify-center" animate={isRec && !lowPower ? { scale: [1, 1.025, 1] } : { scale: 1 }} transition={{ duration: 0.7, repeat: isRec && !lowPower ? Infinity : 0 }}>
                      <Avatar emotion={isSpeaking ? "talking" : emotion} character={character} size={430} />
                    </motion.div>
                  </motion.div>
                </div>
                <div className="monto-companion-footer">
                  <div className="monto-mood-orb"><Sparkles className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <p className="font-kids text-xl leading-none text-white">Monto</p>
                    <p className="mt-1 truncate text-[11px] font-semibold text-sky-100/55">{isRec ? "I’m all ears — tell me anything!" : isSpeaking ? "Sharing something magical…" : "Ready to learn, play and explore"}</p>
                  </div>
                </div>
              </div>

              <div className="monto-console monto-main-console rounded-[28px] p-4 sm:p-6 flex flex-col gap-4 min-h-[480px]">
                <div className="monto-adventure-wrap">
                  <div className="monto-adventure-header">
                    <div className="monto-adventure-heading">
                      <p className="monto-adventure-title">Pick an adventure</p>
                      <span className="monto-slide-guide">
                        Swipe <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <div className="monto-control-pill" role="group" aria-label="Mic and speaker controls">
                      <motion.button
                        onClick={() => {
                          if (!micMuted) recorder.cancelRecording();
                          setMicMuted(value => !value);
                          setApiError(null);
                        }}
                        aria-pressed={micMuted}
                        title={micMuted ? "Turn microphone on" : "Mute microphone"}
                        className={cn("monto-control-seg", micMuted && "is-off")}
                        whileTap={{ scale: .92 }}>
                        {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </motion.button>
                      <span className="monto-control-divider" aria-hidden="true" />
                      <motion.button
                        onClick={() => {
                          if (autoSpeak) cancelTTS();
                          setAutoSpeak(value => !value);
                        }}
                        aria-pressed={!autoSpeak}
                        title={autoSpeak ? "Mute speaker" : "Turn speaker on"}
                        className={cn("monto-control-seg", !autoSpeak && "is-off")}
                        whileTap={{ scale: .92 }}>
                        {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      </motion.button>
                    </div>
                  </div>

                  <div className="monto-slider-shell">
                    <motion.button
                      type="button"
                      className="monto-slider-arrow monto-slider-arrow-prev"
                      onClick={() => adventureSliderRef.current?.scrollBy({ left: -210, behavior: lowPower ? "auto" : "smooth" })}
                      aria-label="Previous adventures"
                      whileTap={{ scale: 0.88 }}>
                      <ChevronLeft className="h-4 w-4" />
                    </motion.button>

                    <div
                      ref={adventureSliderRef}
                      className="monto-adventure-grid monto-adventure-slider"
                      onScroll={handleSliderScroll}
                    >
                      {adventureItems.map((item) => (
                        <motion.button key={item.label} onClick={() => item.action ? item.action() : item.route ? router.push(item.route) : handleMic()}
                          className={`monto-adventure monto-adventure-${item.tone}`} whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}>
                          <item.icon className="monto-adventure-icon" strokeWidth={2.3} />
                          <span>{item.label}</span>
                        </motion.button>
                      ))}
                    </div>

                    <motion.button
                      type="button"
                      className="monto-slider-arrow monto-slider-arrow-next"
                      onClick={() => adventureSliderRef.current?.scrollBy({ left: 210, behavior: lowPower ? "auto" : "smooth" })}
                      aria-label="Next adventures"
                      whileTap={{ scale: 0.88 }}>
                      <ChevronRight className="h-4 w-4" />
                    </motion.button>
                  </div>

                  <div className="monto-slider-dots" role="tablist" aria-label="Adventure slides">
                    {adventureItems.map((item, i) => (
                      <button
                        key={item.label}
                        type="button"
                        role="tab"
                        aria-selected={i === activeAdventure}
                        aria-label={`Go to ${item.label}`}
                        className={cn("monto-slider-dot", i === activeAdventure && "is-active")}
                        onClick={() => scrollToAdventure(i)}
                      />
                    ))}
                  </div>

                  <motion.button
                    onClick={handleMic}
                    disabled={isProc || appControls?.maintenance_mode || appControls?.ai_enabled === false || appControls?.microphone_enabled === false}
                    className={cn(
                      "monto-mic-charge mt-3 w-full rounded-2xl flex items-center justify-center gap-2 py-2.5 font-bold text-sm text-white focus:outline-none disabled:opacity-40",
                      isRec && "is-listening",
                    )}
                    style={{
                      background: isRec
                        ? "linear-gradient(135deg, #EF4444, #DC2626)"
                        : `linear-gradient(135deg, ${cfg.color}, ${cfg.glow})`,
                      boxShadow: isRec
                        ? "0 0 24px rgba(239,68,68,0.45), 0 6px 20px rgba(0,0,0,0.3)"
                        : `0 0 24px ${cfg.glow}45, 0 6px 20px rgba(0,0,0,0.3)`,
                    }}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.97 }}>
                    <AnimatePresence mode="wait">
                      {isProc ? (
                        <motion.div key="spin" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                          <Sparkles className="w-4 h-4" />
                        </motion.div>
                      ) : isRec ? (
                        <motion.div key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <div className="w-3 h-3 rounded-[3px] bg-white" />
                        </motion.div>
                      ) : (
                        <motion.div key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <Mic className="w-4 h-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <span>{isRec ? "Listening… tap to finish" : "Tap to talk"}</span>
                  </motion.button>
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
                  className={cn(
                    "monto-mic-charge w-16 h-16 rounded-full flex items-center justify-center focus:outline-none disabled:opacity-40",
                    isRec && "is-listening",
                  )}
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
        noiseFloor={recorder.noiseFloor}
        calibrating={recorder.calibrating}
        onCalibrate={recorder.calibrate}
        parentConnection={parentConnection}
        onPairParent={() => { setShowSettings(false); setShowPairing(true); }}
      />
    </div>
  );
}




