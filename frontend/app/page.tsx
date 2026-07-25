"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Mic, MicOff, Sparkles, MessageCircle, X, Settings as SettingsIcon, CheckCircle2, Music2, BookOpen, Dumbbell, Compass, Gamepad2, HeartHandshake, Voicemail, User, Clock } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { RocketFlyby } from "@/components/RocketFlyby";
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

// ── Insult detection — English + Hindi/Nepali (Devanagari) ─────────────────────
// If the child says something unkind to Monto, he reacts sad/crying rather than
// treating it like any other query — regardless of what emotion the backend picks.
const INSULT_PATTERNS = [
  /\byou\s*(?:'?re|\s+are)\s+(?:so\s+)?(?:bad|stupid|dumb|ugly|useless|annoying|horrible|terrible|the\s+worst)\b/i,
  /\bi\s+hate\s+you\b/i,
  /\byou\s+suck\b/i,
  /\bshut\s+up\b/i,
  /\byou\s*(?:'?re|\s+are)\s+not\s+(?:good|nice|smart)\b/i,
  /(?:तुम|तू|तुझे|आप)\s*(?:बुरे|बुरी|बुरा|खराब|बेकार|गंदे|गंदा|बेवकूफ|मूर्ख)/,
  /नफरत/,
  /चुप\s*रहो/,
];
function detectsInsult(text: string): boolean {
  return INSULT_PATTERNS.some((pattern) => pattern.test(text));
}

// ── Explore topic picker — cards. Only "Know Nepal" has real bundled photos
// (frontend/public/explore/nepal); the rest use a themed icon chip since no
// photo assets exist for them yet in the project.
const EXPLORE_TOPICS = [
  { scene: "solar-system" as const, label: "Solar System", subtitle: "Planets & Space", photo: "/explore/planet.webp", emoji: "🪐", tone: "violet", transcript: "solar system planets", url: null },
  { scene: "animal-life" as const, label: "Animal Life", subtitle: "Life Cycles", photo: "/explore/animal.webp", emoji: "🦋", tone: "coral", transcript: "animal life cycle butterfly", url: null },
  { scene: "know-nepal" as const, label: "Know Nepal", subtitle: "Culture & History", photo: "/explore/nepal/everest.jpg", emoji: "🏔️", tone: "sky", transcript: "know nepal history culture tradition geography wildlife", url: null },
  { scene: "solar-system" as const, label: "Size of Space", subtitle: "Explore the Universe", photo: "/explore/space.webp", emoji: "🚀", tone: "violet", transcript: "size of space universe", url: "https://neal.fun/size-of-space/" },
  { scene: "animal-life" as const, label: "The Deep Sea", subtitle: "Dive Into the Depths", photo: "/explore/sea.jpg", emoji: "🐋", tone: "sky", transcript: "deep sea ocean depths", url: "https://neal.fun/deep-sea/" },
];


const GREETING_MESSAGES = [
  "Hi! I'm Monto, your AI friend! 🌟",
  "Ask me anything! I love chatting! 😊",
  "Let's learn something fun today! 🚀",
  "What's on your mind? I'm listening! 💭",
];
const AUTO_LISTENING_ENABLED = true;


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
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [volume, setVolumeState]      = useState(0.85);
  const [now, setNow]                 = useState<Date | null>(null);
  const [idleFlying, setIdleFlying]   = useState(false);
  const lastActivityRef               = useRef(Date.now());

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
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

  const busyRef          = useRef(false);
  const ringtoneRef       = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoListenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpokenRef     = useRef(false);
  const recordingStateRef = useRef<RecordingState>("idle");
  const router           = useRouter();
  const recorder = useAudioRecorder();
  const { speak, cancel: cancelTTS, setVolume: setTTSVolume } = useTTS();

  const handleVolumeChange = useCallback((v: number) => {
    setVolumeState(v);
    setTTSVolume(v);
  }, [setTTSVolume]);
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
    const chime = new Audio("/sounds/reminder_ringtone.mp3");
    // Speak the reminder only after the chime finishes — playing both at
    // once made the chime and Monto's voice overlap and drown each other out.
    let announced = false;
    const announce = () => {
      if (announced) return;
      announced = true;
      speak(
        `Reminder! ${reminder.label}`,
        "happy",
        { language: "english", voice: "female", autoSpeak: true, darkMode: true },
        () => {},
        () => {}
      );
    };
    chime.addEventListener("ended", announce, { once: true });
    chime.addEventListener("error", announce, { once: true });
    chime.play().catch(announce);
    setTimeout(() => setActiveReminder(null), 12000);
  }, [speak]);

  useReminderPolling(deviceId, handleReminderDue);

  // ── Music remote control — parent app can push a "play" command over the
  // always-on device control channel; navigate to /songs with that track ──
  const { lastMessage, incomingVoiceNote } = useDeviceChannelContext();
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
      // Duck the ringtone under Monto's announcement instead of layering both
      // at full volume, which made the ring and the voice unintelligible.
      ringtone.volume = 0.2;
      speak(`${callerName} is calling!`, "excited",
        { language: "english", voice: "female", autoSpeak: true, darkMode: true },
        () => {}, () => { if (ringtoneRef.current === ringtone) ringtone.volume = 1; });
      const callerAvatar = typeof lastMessage.callerAvatar === "string" ? lastMessage.callerAvatar : undefined;
      setCalling({ callee: callerName, isIncoming: true, avatar: callerAvatar });
    }
    // Incoming parent voice messages are handled globally in
    // DeviceChannelProvider (so they play — and pre-empt whatever's
    // running — no matter which screen the child is on), not here.
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
      const result = await sendVoiceQuery(blob, lang === "nepali" ? "ne" : undefined);
      setTranscript(result.transcript);
      setResponse(result);
      // If the child said something unkind, Monto reacts sad/crying no matter
      // what emotion the backend assigned to its reply.
      const finalEmotion: Emotion = detectsInsult(result.transcript) ? "sad" : (result.emotion as Emotion);
      setEmotion(finalEmotion);
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
      // Broad multilingual intent matching — English, Hindi/Nepali (Latin
      // transliteration, including common ASR verb-ending variants like
      // -o/-u/-au), and Devanagari script — so a child can ask for a song
      // or story in whatever language/script feels natural to them.
      const PLAY_VERB = /\b(play(?:ing)?|start(?:ed|ing)?|put\s*on|turn(?:ed)?\s*on|resum(?:e|ed|ing)?|continu(?:e|ed|ing)?|queue|begin|hit\s*play|listen|hear|sing|tell|read|narrate|chala(?:o|u|au)?|chala\s*(?:do|dijiye)|baja(?:o|u|au)?|baja\s*do|bajaiye|suna(?:o|u)?|suna\s*do|laga(?:o|u|au)?|laga\s*do|shuru|karo|kar\s*do|gara)\b/i;
      const PLAY_VERB_DEV = /(चला|बजा|सुन|लगा|शुर|सुर|गर|भन|बता|चाहि|मन\s*लाग्यो|प्ले)/;
      const hasPlayIntent = PLAY_VERB.test(lower) || PLAY_VERB_DEV.test(lower);

      const hasSongWord = /\b(songs?|music|tracks?|tunes?|playlist|playback|rhymes?|gaanaa?|ganaa?|geet|sangeet)\b/i.test(lower) || /(गीत|गाना|संगीत)/.test(lower);
      const hasStoryWord = /\b(stor(?:y(?:telling)?|ies)|tales?|fairy\s*tales?|bedtime\s*stor(?:y|ies)|kahani|kahaani|katha)\b/i.test(lower) || /(कथा|कहानी)/.test(lower);

      const onlySongWord = /^(please\s+)?(a\s+|ek\s+|koi\s+)?(songs?|music|tracks?|tunes?|playlist|playback|rhymes?|gaanaa?|ganaa?|geet|sangeet)(\s+please)?[.!?]*$/i.test(lower.trim())
        || /^(गीत|गाना|संगीत)[.!?]*$/.test(lower.trim())
        || /^(music|song)\s*time[.!?]*$/i.test(lower.trim());
      const onlyStoryWord = /^(please\s+)?(a\s+|ek\s+|koi\s+)?(stor(?:y|ies)|tales?|kahani|kahaani|katha)(\s+please)?[.!?]*$/i.test(lower.trim())
        || /^(कथा|कहानी)[.!?]*$/.test(lower.trim())
        || /^story\s*time[.!?]*$/i.test(lower.trim());
      // These name no song/music noun at all, so they can't go through the
      // hasSongWord gate above — match them as their own literal fallback.
      const songNoNounPhrase = /^entertainment\s*mode[.!?]*$/i.test(lower.trim())
        || /^hit\s*play[.!?]*$/i.test(lower.trim())
        || /^play\s+something(\s+\w+)?[.!?]*$/i.test(lower.trim());

      const playSongs = (hasSongWord && (hasPlayIntent || onlySongWord)) || songNoNounPhrase;
      const playStories = hasStoryWord && (hasPlayIntent || onlyStoryWord);
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
          speak(result.response, finalEmotion, settings, () => {}, () => { setIsSpeaking(false); setRS("idle"); });
        }
        return;
      }

      if (autoSpeak && result.response) {
        setRS("speaking");
        setIsSpeaking(true);
        speak(result.response, finalEmotion, settings,
          () => setIsSpeaking(true),
          () => { setIsSpeaking(false); setEmotion(finalEmotion); setRS("idle"); }
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
    enabled: !AUTO_LISTENING_ENABLED && !micMuted && recordingState === "idle" && !isSpeaking && !exploreScene && !calling,
    keywords: ["monto", "hey monto", "hi monto", "montu", "hey montu", "hi montu", "मन्टो", "हे मन्टो"],
    language: lang === "nepali" ? "ne-NP" : "en-US",
  });

  useEffect(() => {
    const blocked =
      micMuted || online !== true || isSpeaking || !!calling || !!exploreScene ||
      showExplorePicker || showSettings || showPairing || incomingVoiceNote ||
      appControls?.maintenance_mode === true || appControls?.ai_enabled === false ||
      appControls?.microphone_enabled === false;

    if (autoListenTimerRef.current) {
      clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }

    if (blocked) {
      if (recorder.recordingState === "recording") recorder.cancelRecording();
      return;
    }

    if (!AUTO_LISTENING_ENABLED || busyRef.current || recordingState !== "idle" || recorder.recordingState !== "idle") return;

    autoListenTimerRef.current = setTimeout(() => {
      autoListenTimerRef.current = null;
      if (busyRef.current) return;
      void recorder.startRecording();
    }, 650);

    return () => {
      if (autoListenTimerRef.current) {
        clearTimeout(autoListenTimerRef.current);
        autoListenTimerRef.current = null;
      }
    };
  }, [
    appControls?.ai_enabled, appControls?.maintenance_mode, appControls?.microphone_enabled,
    calling, exploreScene, incomingVoiceNote, isSpeaking, micMuted, online,
    recorder.cancelRecording, recorder.recordingState, recorder.startRecording,
    recordingState, showExplorePicker, showPairing, showSettings,
  ]);
  const isRec    = recordingState === "recording";
  const isProc   = recordingState === "processing" || recordingState === "requesting";

  // ── Idle "rocket flyby" easter egg ───────────────────────────────────────
  // After a stretch of no activity, Monto hops on a rocket and flies off —
  // purely decorative, plays once then waits for the next idle stretch.
  const busyNow = isRec || isProc || isSpeaking || showChat || !!calling || !!exploreScene || showSettings || showPairing || showExplorePicker;
  useEffect(() => {
    if (busyNow) { lastActivityRef.current = Date.now(); setIdleFlying(false); }
  }, [busyNow]);

  useEffect(() => {
    const mark = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("pointerdown", mark);
    window.addEventListener("keydown", mark);
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  useEffect(() => {
    const IDLE_THRESHOLD_MS = 22_000;
    const FLIGHT_DURATION_MS = 4_300;
    const interval = setInterval(() => {
      if (busyNow || idleFlying) return;
      if (Date.now() - lastActivityRef.current > IDLE_THRESHOLD_MS) {
        setIdleFlying(true);
        lastActivityRef.current = Date.now();
        setTimeout(() => setIdleFlying(false), FLIGHT_DURATION_MS);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [busyNow, idleFlying]);

  // ── Adventure slider ─────────────────────────────────────────────────────
  const adventureItems = [
    { label: "Music", icon: Music2, route: "/songs", tone: "coral", subtitle: "Songs & Rhymes", enabled: appControls?.songs_enabled !== false },
    { label: "Stories", icon: BookOpen, route: "/stories", tone: "violet", subtitle: "Listen & Learn", enabled: appControls?.stories_enabled !== false },
    { label: "Exercise", icon: Dumbbell, route: "/yoga", tone: "mint", subtitle: "Move & Play", enabled: appControls?.yoga_enabled !== false },
    { label: "Games", icon: Gamepad2, route: "/games", tone: "sun", subtitle: "Fun & Play", enabled: true },
    { label: "Moral Game", icon: HeartHandshake, route: "/moral-game", tone: "rose", subtitle: "Values & Fun", enabled: true },
    { label: "Explore", icon: Compass, action: () => setShowExplorePicker(true), tone: "sky", subtitle: "Discover More", enabled: true },
  ].filter(item => item.enabled);

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
            <motion.div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowExplorePicker(false)} />
            <motion.div
              className="monto-light-modal relative z-10 w-full max-w-lg rounded-3xl overflow-hidden p-5 sm:p-6"
              initial={{ y: 40, scale: 0.94, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 30, scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-800 font-black text-lg flex items-center gap-2">🔭 Pick something to explore</span>
                <button onClick={() => setShowExplorePicker(false)} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {EXPLORE_TOPICS.map((topic, i) => (
                  <motion.button
                    key={topic.label}
                    onClick={() => {
                      if (topic.url) {
                        setShowExplorePicker(false);
                        window.location.assign(topic.url);
                        return;
                      }
                      setExploreScene(topic.scene);
                      setExploreTranscript(topic.transcript);
                      setShowExplorePicker(false);
                    }}
                    initial={{ opacity: 0, y: 12, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.05, type: "spring", stiffness: 320, damping: 24 }}
                    whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}
                    className={cn(
                      "monto-light-card",
                      topic.photo ? "monto-light-card-photo" : `monto-light-card-${topic.tone}`,
                    )}
                    style={topic.photo ? { backgroundImage: `url(${topic.photo})` } : undefined}
                  >
                    {!topic.photo && <div className="monto-light-card-icon"><span className="text-2xl">{topic.emoji}</span></div>}
                    <p className="monto-light-card-title">{topic.label}</p>
                    <p className="monto-light-card-subtitle">{topic.subtitle}</p>
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

      {/* Incoming voice note toast now renders globally via VoiceNoteToast
          in the root layout, so it shows on every screen, not just here. */}

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
      <div className="monto-header-band relative z-20 w-full">
      <header className="relative flex items-center justify-between w-full max-w-7xl mx-auto px-5 sm:px-7 pt-safe pt-3 pb-2">
        {/* Status pill */}
        <motion.div className="monto-light-pill flex items-center gap-2 px-4 py-2"
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <Sparkles className="w-3.5 h-3.5 monto-light-accent" />
          <span className="text-xs font-bold text-slate-600">
            {online ? "Online" : "Reconnecting"}
          </span>
          <motion.div
            className={cn("w-2 h-2 rounded-full", online ? "bg-emerald-500" : "bg-amber-500")}
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        {/* Brand */}
        <motion.div className="text-center" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-center gap-1.5">
            <div className="font-kids text-2xl sm:text-3xl leading-none monto-wordmark">MONTO</div>
            <motion.div
              className="w-4 h-5 sm:w-5 sm:h-6"
              style={{ transformOrigin: "0% 100%" }}
              animate={{ rotate: [0, 16, -12, 16, -6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
            >
              <NepalFlag className="w-full h-full" />
            </motion.div>
          </div>
          <div className="text-[10px] tracking-[0.3em] text-rose-100/80 font-bold uppercase mt-0.5">Learn &bull; Play &bull; Grow</div>
        </motion.div>

        {/* Right side: Settings + Parent + Chat toggle */}
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setShowSettings(true)}
            className="monto-light-pill flex items-center gap-1.5 px-3.5 py-2"
            whileTap={{ scale: 0.92 }}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            aria-label="Open settings"
          >
            <SettingsIcon className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline text-xs font-bold text-slate-600">Settings</span>
          </motion.button>
          <motion.button
            onClick={() => setShowPairing(true)}
            className="monto-light-pill flex items-center gap-1.5 px-3.5 py-2"
            whileTap={{ scale: 0.92 }}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            aria-label="Pair with Parent App"
          >
            <User className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline text-xs font-bold text-slate-600">Parent</span>
          </motion.button>
          <motion.button
            onClick={() => router.push("/voice-messages")}
            className="monto-light-pill flex items-center justify-center w-9 h-9 px-0"
            whileTap={{ scale: 0.85 }}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            aria-label="Voice messages"
          >
            <Voicemail className="w-4 h-4 text-slate-500" />
          </motion.button>
          <motion.button
            onClick={() => setShowChat(v => !v)}
            className="monto-light-pill flex items-center justify-center w-9 h-9 px-0"
            whileTap={{ scale: 0.85 }}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            aria-label={showChat ? "Close chat" : "Open chat"}
          >
            {showChat
              ? <X className="w-4 h-4 text-slate-500" />
              : <MessageCircle className="w-4 h-4 text-slate-500" />}
          </motion.button>
        </div>
      </header>
      </div>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 sm:px-6 lg:px-8 pb-safe pb-6 max-w-7xl mx-auto w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {!showChat ? (
            <motion.div key="voice" className="monto-light-hero rounded-[34px] p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[minmax(360px,1.05fr)_minmax(420px,0.95fr)] items-stretch gap-5 lg:gap-7 w-full flex-1 overflow-y-auto"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Left: avatar panel */}
              <div className="monto-light-scene rounded-[28px] p-5 flex flex-col items-center gap-1">
                <div className="w-full flex items-center justify-between gap-2">
                  <div>
                    <p className="monto-light-muted text-[11px] font-black uppercase tracking-[0.22em]">Your AI buddy</p>
                    <h2 className="font-kids text-2xl text-slate-800">Meet Monto</h2>
                  </div>
                  <div className={cn("monto-live-pill", isRec && "is-listening", isSpeaking && "is-speaking")}>
                    <span />
                    {isRec ? "Listening" : isSpeaking ? "Talking" : "Ready"}
                  </div>
                </div>
                <motion.div className="flex-1 flex items-start justify-center w-full pt-1"
                  animate={isRec && !lowPower ? { scale: [1, 1.03, 1] } : {}} transition={{ duration: 0.3, repeat: Infinity }}>
                  <AnimatePresence mode="wait">
                    {idleFlying && !lowPower ? (
                      <motion.div key="rocket" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <RocketFlyby size={340}>
                          <Avatar emotion="excited" character={character} size={260} />
                        </RocketFlyby>
                      </motion.div>
                    ) : (
                      <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Avatar emotion={isSpeaking ? "talking" : emotion} character={character} size={420} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                <p className="text-center text-sm font-bold monto-light-muted px-2">
                  {idleFlying ? "Wheee — off on a rocket adventure!" : isRec ? "I’m all ears — tell me anything!" : isSpeaking ? "Sharing something magical…" : "Ready to learn, play and explore"}
                </p>
              </div>

              {/* Right: adventures + talk button + status + reply */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.25em] monto-light-muted">Pick an adventure</p>
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

                <div className={cn(
                  "grid grid-cols-2 sm:grid-cols-3 gap-4",
                  // A lone item left dangling in the last row looks unintentional —
                  // stretch it to fill the row instead, at whichever breakpoint(s)
                  // would otherwise leave it alone.
                  adventureItems.length % 2 === 1 && "[&>*:last-child]:col-span-2",
                  adventureItems.length % 3 === 1 ? "sm:[&>*:last-child]:col-span-3" : "sm:[&>*:last-child]:col-span-1",
                )}>
                  {adventureItems.map((item) => (
                    <motion.button key={item.label} onClick={() => item.action ? item.action() : item.route ? router.push(item.route) : handleMic()}
                      className={`monto-light-card monto-light-card-${item.tone}`} whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}>
                      <div className="monto-light-card-icon"><item.icon className="w-8 h-8" strokeWidth={2.2} /></div>
                      <p className="monto-light-card-title">{item.label}</p>
                      <p className="monto-light-card-subtitle">{item.subtitle}</p>
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  onClick={handleMic}
                  disabled={isProc || appControls?.maintenance_mode || appControls?.ai_enabled === false || appControls?.microphone_enabled === false}
                  className={cn(
                    "monto-mic-charge monto-light-mic w-full rounded-2xl flex items-center justify-center gap-2 py-3 font-bold text-sm text-white focus:outline-none disabled:opacity-40",
                    isRec && "is-listening",
                  )}
                  style={{
                    background: isRec ? "linear-gradient(135deg, #EF4444, #DC2626)" : "linear-gradient(135deg, #FB7185, #E11D48)",
                    boxShadow: isRec ? "0 10px 26px rgba(239,68,68,0.4)" : "0 10px 26px rgba(225,29,72,0.35)",
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

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className={cn(
                      "text-sm font-semibold",
                      apiError ? "text-red-500" : isProc ? "text-violet-500" : "monto-light-muted",
                    )}>
                      {statusText}
                    </p>
                    <div className="monto-light-pill px-3 py-1 text-[11px] font-bold monto-light-muted">
                      {lang === "nepali" ? "नेपाली" : "EN"}
                    </div>
                  </div>
                  {isRec && (
                    <motion.div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}>
                      <AudioBars level={recorder.audioLevel} color="#E11D48" />
                    </motion.div>
                  )}
                </div>

                <div className="flex-1">
                  <AnimatePresence mode="wait">
                    {response ? (
                      <motion.div key="response"
                        className="monto-light-response relative rounded-[24px] p-5"
                        initial={{ opacity: 0, y: 24, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      >
                        {transcript && (
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-rose-100">
                              <Mic className="w-3 h-3 text-rose-500" />
                            </div>
                            <p className="text-slate-500 text-xs leading-snug">{transcript}</p>
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <motion.div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #FB7185, #E11D48)" }}
                            animate={isSpeaking ? { scale: [1, 1.12, 1] } : {}}
                            transition={{ duration: 0.5, repeat: Infinity }}
                          >
                            <Sparkles className="w-4 h-4 text-white" />
                          </motion.div>
                          <div className="flex-1">
                            <p className="text-[11px] uppercase tracking-[0.3em] monto-light-muted mb-2">Monto reply</p>
                            <p className="text-slate-700 text-sm leading-relaxed font-medium">
                              {response.response}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="greeting"
                        className="monto-light-response rounded-[24px] p-6 text-center"
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}>
                        <Sparkles className="w-5 h-5 monto-light-accent mx-auto mb-3" />
                        <p className="text-slate-700 text-lg sm:text-xl font-extrabold leading-snug">{greeting}</p>
                        <p className="monto-light-muted text-xs mt-2">Ask a question, tell a joke, or start an adventure.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

          ) : (
            /* ── Chat view ──────────────────────────────────────────── */
            <motion.div key="chat" className="monto-light-hero rounded-[34px] p-4 sm:p-6 flex flex-col w-full flex-1 overflow-hidden"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 py-3 px-1">
                {conversation.messages.length === 0 && (
                  <div className="text-center monto-light-muted text-sm mt-8">{greeting}</div>
                )}
                <AnimatePresence initial={false}>
                  {conversation.messages.map((msg) => {
                    const isUser = msg.role === "user";
                    const mCfg = EMOTION_CONFIG[(msg.emotion ?? "neutral") as keyof typeof EMOTION_CONFIG] ?? EMOTION_CONFIG.neutral;
                    return (
                      <motion.div key={msg.id}
                        className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}>
                        <div className="flex">
                          {!isUser && (
                            <div className="w-7 h-7 rounded-full mr-2 flex-shrink-0 mt-1 flex items-center justify-center"
                                 style={{ background: `linear-gradient(135deg, ${mCfg.color}, ${mCfg.glow})` }}>
                              <Sparkles className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className={cn("max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed font-medium")}
                               style={isUser
                                 ? { background: `linear-gradient(135deg, #FB7185, #E11D48)`, color: "white", borderBottomRightRadius: 6 }
                                 : { background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#334155", borderBottomLeftRadius: 6 }}>
                            {msg.text}
                          </div>
                        </div>
                        {!isUser && (
                          <button type="button"
                            onClick={() => {
                              cancelTTS();
                              setReplayingId(msg.id);
                              setIsSpeaking(true);
                              speak(msg.text, msg.emotion ?? "neutral", settings,
                                () => setIsSpeaking(true),
                                () => { setIsSpeaking(false); setReplayingId(null); });
                            }}
                            title="Replay"
                            aria-label="Replay this message"
                            className="mt-1 ml-9 flex items-center gap-1 text-[11px] font-medium monto-light-muted hover:text-slate-700 transition-colors focus:outline-none">
                            <Volume2 className={cn("w-3.5 h-3.5", replayingId === msg.id && "animate-pulse monto-light-accent")} />
                            <span>{replayingId === msg.id ? "Playing…" : "Replay"}</span>
                          </button>
                        )}
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
                    "monto-mic-charge monto-light-mic w-16 h-16 rounded-full flex items-center justify-center focus:outline-none disabled:opacity-40",
                    isRec && "is-listening",
                  )}
                  style={{
                    background: isRec
                      ? "linear-gradient(135deg, #EF4444, #DC2626)"
                      : "linear-gradient(135deg, #FB7185, #E11D48)",
                    boxShadow: "0 10px 26px rgba(225,29,72,0.35)",
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

        {/* Status bar */}
        <div className="monto-light-statusbar mt-3 w-full flex items-center justify-between gap-4 px-2 py-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500">
            <Clock className="w-4 h-4" />
            <span>{now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}</span>
            <span className="opacity-40">|</span>
            <span>Today is {now ? now.toLocaleDateString([], { weekday: "long" }) : "…"}</span>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-[220px]">
            {volume > 0 ? <Volume2 className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <VolumeX className="w-4 h-4 text-slate-400 flex-shrink-0" />}
            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="monto-volume-slider flex-1"
              aria-label="Speaker volume"
            />
          </div>
        </div>
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




