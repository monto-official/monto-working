"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Mic, Sparkles, Star, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useTTS } from "@/hooks/useTTS";
import { useConversation } from "@/hooks/useConversation";
import { useWakeWord } from "@/hooks/useWakeWord";
import { sendVoiceQuery, checkHealth, APIError } from "@/lib/api";
import { Emotion, RecordingState, Settings, VoiceQueryResponse } from "@/types";
import { cn } from "@/lib/utils";

const DEFAULT_SETTINGS: Settings = {
  language: "english",
  voice: "female",
  autoSpeak: true,
  darkMode: true,
};

// ── Star background ───────────────────────────────────────────────────────────
function StarField() {
  const stars = Array.from({ length: 30 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 3,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {stars.map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
          }}
          animate={{ opacity: [0.1, 0.8, 0.1], scale: [1, 1.4, 1] }}
          transition={{ duration: 2 + s.delay, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── Floating emojis ───────────────────────────────────────────────────────────
const EMOTION_EMOJIS: Record<string, string[]> = {
  happy:     ["😊", "🌟", "✨", "🎉"],
  excited:   ["🤩", "🎊", "⭐", "🚀"],
  sad:       ["💛", "🤗", "💙"],
  thinking:  ["🤔", "💭", "💡"],
  surprised: ["😲", "✨", "🎯"],
  neutral:   ["😊", "🌟"],
  idle:      ["✨", "🌟"],
};

function FloatingEmojis({ emotion }: { emotion: string }) {
  const emojis = EMOTION_EMOJIS[emotion] || EMOTION_EMOJIS.idle;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {emojis.map((emoji, i) => (
        <motion.div
          key={`${emotion}-${i}`}
          className="absolute text-2xl"
          style={{ left: `${15 + i * 25}%`, bottom: "10%" }}
          initial={{ y: 0, opacity: 0, scale: 0 }}
          animate={{ y: [-20, -120], opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8] }}
          transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, repeatDelay: 2 }}
        >
          {emoji}
        </motion.div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [settings]        = useState<Settings>(DEFAULT_SETTINGS);
  const [emotion, setEmotion]           = useState<Emotion>("neutral");
  const [transcript, setTranscript]     = useState("");
  const [response, setResponse]         = useState<VoiceQueryResponse | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [apiError, setApiError]         = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking]     = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [autoSpeak, setAutoSpeak]       = useState(true);
  const [wakeEnabled, setWakeEnabled]   = useState(false);
  const [showChat, setShowChat]         = useState(false);
  const busyRef = useRef(false);

  const recorder     = useAudioRecorder();
  const { speak, cancel: cancelTTS } = useTTS();
  const conversation = useConversation();

  useEffect(() => { checkHealth().then(setBackendOnline); }, []);

  // ── Process audio ─────────────────────────────────────────────────────────
  const processAudio = useCallback(async (blob: Blob) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRecordingState("processing");
    setEmotion("thinking");
    cancelTTS();

    try {
      const result = await sendVoiceQuery(blob);
      setTranscript(result.transcript);
      setResponse(result);
      setEmotion(result.emotion as Emotion);
      conversation.addUserMessage(result.transcript);
      conversation.addAssistantMessage(result);

      if (autoSpeak && result.response) {
        setRecordingState("speaking");
        setIsSpeaking(true);
        speak(result.response, result.emotion, settings,
          () => setIsSpeaking(true),
          () => { setIsSpeaking(false); setEmotion(result.emotion as Emotion); setRecordingState("idle"); }
        );
      } else {
        setRecordingState("idle");
      }
    } catch (err) {
      const msg = err instanceof APIError ? err.message : "Oops! Something went wrong 😢";
      setApiError(msg);
      setEmotion("sad");
      setRecordingState("error");
      setTimeout(() => { setApiError(null); setRecordingState("idle"); setEmotion("neutral"); }, 3000);
    } finally {
      busyRef.current = false;
    }
  }, [autoSpeak, settings, speak, cancelTTS, conversation]);

  // ── Mic button press ──────────────────────────────────────────────────────
  const handleMicPress = useCallback(async () => {
    if (busyRef.current) return;
    setApiError(null);

    if (recorder.recordingState === "recording") {
      const blob = await recorder.stopRecording();
      if (!blob || blob.size < 1000) {
        setApiError("Too short! Please speak a little longer 🎤");
        setRecordingState("error");
        setTimeout(() => { setApiError(null); setRecordingState("idle"); }, 3000);
        return;
      }
      await processAudio(blob);
    } else {
      setTranscript("");
      setResponse(null);
      setEmotion("neutral");
      await recorder.startRecording();
      setRecordingState("recording");
    }
  }, [recorder, processAudio]);

  // Sync recorder state
  useEffect(() => {
    if (recorder.recordingState === "requesting") setRecordingState("requesting");
    if (recorder.recordingState === "recording")  setRecordingState("recording");
    if (recorder.recordingState === "error") {
      setApiError(recorder.error);
      setRecordingState("error");
    }
  }, [recorder.recordingState, recorder.error]);

  // ── Wake word ─────────────────────────────────────────────────────────────
  const { supported: wakeSupported, listening: wakeListening } = useWakeWord({
    onDetected: () => { if (recordingState === "idle" && backendOnline) handleMicPress(); },
    enabled: wakeEnabled && recordingState === "idle",
  });

  const isRecording   = recordingState === "recording";
  const isProcessing  = recordingState === "processing" || recordingState === "requesting";
  const isBusy        = isRecording || isProcessing || isSpeaking;

  // Emotion → accent color
  const accentColor = {
    happy:     "#FBBF24",
    excited:   "#F472B6",
    sad:       "#60A5FA",
    thinking:  "#A78BFA",
    surprised: "#34D399",
    neutral:   "#818CF8",
    talking:   "#818CF8",
  }[emotion] ?? "#818CF8";

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
         style={{ background: "linear-gradient(180deg, #0F0A1E 0%, #1E0A3C 50%, #0A0F2E 100%)" }}>

      <StarField />

      {/* Floating emojis when responding */}
      <AnimatePresence>
        {(emotion === "happy" || emotion === "excited") && <FloatingEmojis emotion={emotion} />}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3">
        {/* Backend status */}
        <div className="flex items-center gap-2">
          <motion.div
            className={cn("w-2.5 h-2.5 rounded-full", backendOnline ? "bg-green-400" : "bg-red-400")}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs text-white/50">
            {backendOnline ? "Connected" : "Offline"}
          </span>
        </div>

        {/* Logo */}
        <motion.div className="text-center" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-kids text-2xl shimmer-text tracking-wide">
            MONTO KIDS
          </h1>
          <p className="text-white/60 text-[10px] tracking-widest uppercase">AI Sathi ✦</p>
        </motion.div>

        {/* Chat toggle */}
        <button
          onClick={() => setShowChat(v => !v)}
          className="text-white/60 hover:text-white transition-colors text-xs font-semibold"
        >
          {showChat ? "Voice" : "Chat"}
        </button>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-5 pb-6 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {!showChat ? (
            <motion.div key="voice" className="flex flex-col items-center w-full flex-1"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

              {/* Avatar with glow */}
              <div className="relative mt-2 mb-4">
                {/* Outer glow ring */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: `radial-gradient(circle, ${accentColor}40 0%, transparent 70%)` }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* Avatar */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Avatar emotion={emotion} size={200} />
                </motion.div>

                {/* Speaking sound waves */}
                <AnimatePresence>
                  {isSpeaking && (
                    <div className="absolute -right-4 top-1/2 -translate-y-1/2">
                      {[0, 1, 2].map(i => (
                        <motion.div key={i}
                          className="absolute rounded-full border-2"
                          style={{ borderColor: accentColor + "80" }}
                          initial={{ width: 20, height: 20, x: -10, y: -10, opacity: 0 }}
                          animate={{ width: [20, 60], height: [20, 60], x: [-10, -30], y: [-10, -30], opacity: [0.8, 0] }}
                          transition={{ duration: 1.2, delay: i * 0.3, repeat: Infinity }}
                        />
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Name tag */}
              <motion.div className="text-center mb-4"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <p className="text-white/50 text-sm">
                  {recordingState === "idle"     && !wakeListening && "Tap the mic or say 'Monto'"}
                  {recordingState === "idle"     && wakeListening  && "🎙 Listening for 'Monto'..."}
                  {recordingState === "recording" && "🔴 Listening... tap to stop"}
                  {recordingState === "processing" && "💭 Thinking..."}
                  {recordingState === "speaking"   && "🔊 Monto is speaking..."}
                  {recordingState === "error"      && (apiError || "Something went wrong")}
                </p>
              </motion.div>

              {/* Response card */}
              <AnimatePresence>
                {response?.response && (
                  <motion.div
                    key="response"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="w-full mb-4 rounded-3xl p-4 relative overflow-hidden"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      backdropFilter: "blur(20px)",
                      border: `1px solid ${accentColor}40`,
                    }}
                  >
                    {/* Accent top border */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 rounded-full"
                         style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

                    {transcript && (
                      <p className="text-white/50 text-xs mb-2 flex items-center gap-1.5">
                        <Mic className="w-3 h-3" />
                        {transcript}
                      </p>
                    )}
                    <div className="flex items-start gap-2">
                      <motion.div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `linear-gradient(135deg, ${accentColor}, #EC4899)` }}
                        animate={isSpeaking ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      >
                        <Sparkles className="w-3 h-3 text-white" />
                      </motion.div>
                      <p className="text-white text-sm leading-relaxed font-medium">
                        {response.response}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Backend offline */}
              <AnimatePresence>
                {backendOnline === false && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="w-full mb-4 rounded-2xl bg-red-500/20 border border-red-500/40 p-3 flex items-center gap-2">
                    <p className="text-red-300 text-xs flex-1">Backend offline — start the server!</p>
                    <button onClick={() => checkHealth().then(setBackendOnline)}>
                      <RefreshCw className="w-4 h-4 text-red-300" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Controls */}
              <div className="flex flex-col items-center gap-5 w-full mt-auto">
                {/* Mic button */}
                <div className="relative flex items-center justify-center">
                  {/* Recording rings */}
                  <AnimatePresence>
                    {isRecording && [0, 1, 2].map(i => (
                      <motion.div key={i}
                        className="absolute rounded-full"
                        style={{ border: `2px solid ${accentColor}` }}
                        initial={{ width: 88, height: 88, opacity: 0.8 }}
                        animate={{ width: 88 + i * 40 + recorder.audioLevel * 20, height: 88 + i * 40 + recorder.audioLevel * 20, opacity: 0 }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                      />
                    ))}
                  </AnimatePresence>

                  <motion.button
                    onClick={handleMicPress}
                    disabled={backendOnline === false || isProcessing}
                    className={cn(
                      "relative z-10 w-22 h-22 rounded-full flex items-center justify-center",
                      "focus:outline-none",
                      isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                    )}
                    style={{
                      width: 88, height: 88,
                      background: isRecording
                        ? "linear-gradient(135deg, #EF4444, #DC2626)"
                        : `linear-gradient(135deg, ${accentColor}, #EC4899)`,
                      boxShadow: isRecording
                        ? "0 0 30px rgba(239,68,68,0.6)"
                        : `0 0 30px ${accentColor}80`,
                    }}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                  >
                    <AnimatePresence mode="wait">
                      {isProcessing ? (
                        <motion.div key="spin"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                          <Sparkles className="w-9 h-9 text-white" />
                        </motion.div>
                      ) : isRecording ? (
                        <motion.div key="stop"
                          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <div className="w-7 h-7 bg-white rounded-md" />
                        </motion.div>
                      ) : (
                        <motion.div key="mic"
                          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <Mic className="w-9 h-9 text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>

                {/* Secondary controls */}
                <div className="flex items-center gap-4">
                  {/* Volume */}
                  <motion.button
                    onClick={() => setAutoSpeak(v => !v)}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {autoSpeak
                      ? <Volume2 className="w-5 h-5 text-white/80" />
                      : <VolumeX className="w-5 h-5 text-white/40" />}
                  </motion.button>

                  {/* Wake word */}
                  {wakeSupported && (
                    <motion.button
                      onClick={() => setWakeEnabled(v => !v)}
                      className="px-4 h-12 rounded-2xl flex items-center gap-2 text-xs font-bold"
                      style={{
                        background: wakeEnabled ? `${accentColor}30` : "rgba(255,255,255,0.1)",
                        border: `1px solid ${wakeEnabled ? accentColor : "rgba(255,255,255,0.15)"}`,
                        color: wakeEnabled ? accentColor : "rgba(255,255,255,0.5)",
                      }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <motion.div
                        className="w-2 h-2 rounded-full"
                        style={{ background: wakeEnabled && wakeListening ? accentColor : "rgba(255,255,255,0.3)" }}
                        animate={wakeEnabled && wakeListening ? { scale: [1, 1.5, 1] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      {wakeEnabled ? (wakeListening ? "Listening..." : "Wake On") : "Say Monto"}
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>

          ) : (
            /* ── Chat view ───────────────────────────────────────────────── */
            <motion.div key="chat" className="flex flex-col w-full flex-1 overflow-hidden"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

              <div className="flex-1 overflow-y-auto space-y-3 py-3">
                <AnimatePresence>
                  {conversation.messages.map((msg) => (
                    <motion.div key={msg.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn("max-w-[80%] px-4 py-3 rounded-3xl text-sm leading-relaxed")}
                        style={msg.role === "user"
                          ? { background: "linear-gradient(135deg, #7C3AED, #EC4899)", color: "white" }
                          : { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}
                      >
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="flex flex-col items-center gap-3 pt-3">
                <div className="relative flex items-center justify-center">
                  <motion.button onClick={handleMicPress}
                    disabled={backendOnline === false || isProcessing}
                    className="w-16 h-16 rounded-full flex items-center justify-center focus:outline-none"
                    style={{
                      background: isRecording
                        ? "linear-gradient(135deg, #EF4444, #DC2626)"
                        : `linear-gradient(135deg, ${accentColor}, #EC4899)`,
                      boxShadow: `0 0 25px ${accentColor}60`,
                    }}
                    whileTap={{ scale: 0.9 }}>
                    {isProcessing
                      ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                          <Sparkles className="w-7 h-7 text-white" />
                        </motion.div>
                      : isRecording
                        ? <div className="w-5 h-5 bg-white rounded" />
                        : <Mic className="w-7 h-7 text-white" />}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
