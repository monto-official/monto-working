"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Volume2, VolumeX, AlertCircle, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { MicButton } from "@/components/MicButton";
import { StatusIndicator } from "@/components/StatusIndicator";
import { TranscriptCard } from "@/components/TranscriptCard";
import { ResponseCard } from "@/components/ResponseCard";
import { ChatWindow } from "@/components/ChatWindow";
import { Sidebar } from "@/components/Sidebar";
import { SettingsModal } from "@/components/SettingsModal";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useTTS } from "@/hooks/useTTS";
import { useConversation } from "@/hooks/useConversation";
import { sendVoiceQuery, checkHealth, APIError } from "@/lib/api";
import { Emotion, RecordingState, Settings, VoiceQueryResponse } from "@/types";
import { cn } from "@/lib/utils";

const DEFAULT_SETTINGS: Settings = {
  language: "english",
  voice: "female",
  autoSpeak: true,
  darkMode: false,
};

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem("monto_settings");
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function Home() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState<VoiceQueryResponse | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"history" | "about">("history");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [view, setView] = useState<"chat" | "voice">("voice");

  const recorder = useAudioRecorder();
  const { speak, cancel: cancelTTS, usingElevenLabs } = useTTS();
  const conversation = useConversation();

  // Load settings and check backend on mount
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    if (s.darkMode) document.documentElement.classList.add("dark");
    checkHealth().then(setBackendOnline);
  }, []);

  // Sync dark mode
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.darkMode]);

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      localStorage.setItem("monto_settings", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleMicPress = useCallback(async () => {
    setApiError(null);

    // If currently recording, stop and process
    if (recorder.recordingState === "recording") {
      const blob = await recorder.stopRecording();
      if (!blob || blob.size < 1000) {
        setApiError("Recording too short — please hold the button and speak.");
        setRecordingState("error");
        setTimeout(() => setRecordingState("idle"), 3000);
        return;
      }

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

        if (settings.autoSpeak && result.response) {
          setRecordingState("speaking");
          setIsSpeaking(true);
          // Keep the LLM emotion on face during speaking — don't override with "talking"
          speak(
            result.response,
            result.emotion,   // ← pass emotion so voice tone matches
            settings,
            () => { setIsSpeaking(true); },
            () => {
              setIsSpeaking(false);
              setEmotion(result.emotion as Emotion);
              setRecordingState("idle");
            }
          );
        } else {
          setRecordingState("idle");
        }
      } catch (err) {
        const msg =
          err instanceof APIError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to get a response. Please try again.";
        setApiError(msg);
        setEmotion("sad");
        setRecordingState("error");
        setTimeout(() => setRecordingState("idle"), 3000);
      }
    } else {
      // Start recording
      setTranscript("");
      setResponse(null);
      setEmotion("neutral");
      setApiError(null);
      await recorder.startRecording();
      setRecordingState("recording");
    }
  }, [recorder, settings, speak, cancelTTS, conversation]);

  // Keep local recordingState in sync with recorder
  useEffect(() => {
    if (recorder.recordingState === "requesting") setRecordingState("requesting");
    if (recorder.recordingState === "recording") setRecordingState("recording");
    if (recorder.recordingState === "error") {
      setApiError(recorder.error);
      setRecordingState("error");
    }
  }, [recorder.recordingState, recorder.error]);

  const handleNewChat = useCallback(() => {
    conversation.clearHistory();
    setTranscript("");
    setResponse(null);
    setEmotion("neutral");
    setApiError(null);
    setRecordingState("idle");
    cancelTTS();
  }, [conversation, cancelTTS]);

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col bg-white dark:bg-gray-950 transition-colors duration-300",
        "selection:bg-primary-200 selection:text-primary-900"
      )}
    >
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        messages={conversation.messages}
        darkMode={settings.darkMode}
        onToggleDark={() => updateSettings({ darkMode: !settings.darkMode })}
        onNewChat={handleNewChat}
        onOpenSettings={() => setSettingsOpen(true)}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
      />

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white tracking-tight">
            Monto AI
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Backend status dot */}
          {backendOnline !== null && (
            <div
              title={backendOnline ? "Backend connected" : "Backend offline"}
              className={cn(
                "w-2 h-2 rounded-full",
                backendOnline ? "bg-green-400" : "bg-red-400"
              )}
            />
          )}
          {/* ElevenLabs badge */}
          {backendOnline && (
            <span
              title={usingElevenLabs ? "ElevenLabs TTS active" : "Browser TTS fallback"}
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                usingElevenLabs
                  ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400"
              )}
            >
              {usingElevenLabs ? "11" : "TTS"}
            </span>
          )}
          {/* View toggle */}
          <button
            onClick={() => setView(view === "voice" ? "chat" : "voice")}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1"
            aria-label="Toggle view"
          >
            <span className="text-xs font-semibold text-primary-500">
              {view === "voice" ? "Chat" : "Voice"}
            </span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-2 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "voice" ? (
            <motion.div
              key="voice"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1"
            >
              {/* Avatar section */}
              <div className="flex flex-col items-center pt-4 pb-2">
                <Avatar emotion={emotion} size={180} />

                {/* Title */}
                <motion.div
                  className="text-center mt-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Hello, I&apos;m Monto
                  </h1>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                    Your Child-Safe AI Companion
                  </p>
                </motion.div>
              </div>

              {/* Backend offline banner */}
              <AnimatePresence>
                {backendOnline === false && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Backend is offline. Make sure FastAPI is running on port 8000.
                    </p>
                    <button
                      onClick={() => checkHealth().then(setBackendOnline)}
                      className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Transcript + Response cards */}
              <div className="space-y-2 mb-3 flex-1">
                <TranscriptCard transcript={transcript} />
                <ResponseCard
                  response={response?.response ?? ""}
                  emotion={response?.emotion as Emotion}
                  intent={response?.intent}
                  isSpeaking={isSpeaking}
                />
              </div>

              {/* Controls */}
              <div className="flex flex-col items-center gap-3 pb-6">
                <StatusIndicator
                  state={recordingState}
                  error={apiError}
                />

                <div className="flex items-center gap-6">
                  {/* TTS toggle */}
                  <button
                    onClick={() => {
                      if (isSpeaking) {
                        cancelTTS();
                        setIsSpeaking(false);
                        setRecordingState("idle");
                        setEmotion(response?.emotion as Emotion ?? "neutral");
                      }
                      updateSettings({ autoSpeak: !settings.autoSpeak });
                    }}
                    className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Toggle auto speak"
                  >
                    {settings.autoSpeak ? (
                      <Volume2 className="w-5 h-5 text-primary-500" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  <MicButton
                    state={recordingState}
                    audioLevel={recorder.audioLevel}
                    onPress={handleMicPress}
                    disabled={backendOnline === false}
                  />

                  {/* Placeholder for balance */}
                  <div className="w-11 h-11" />
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
                  {recordingState === "recording"
                    ? "Tap again to stop"
                    : "Tap the mic to speak"}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="flex-1 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 rounded-2xl my-2 bg-gray-50 dark:bg-gray-900">
                <ChatWindow messages={conversation.messages} />
              </div>

              {/* Mic button in chat view */}
              <div className="flex flex-col items-center gap-2 pb-4">
                <StatusIndicator state={recordingState} error={apiError} />
                <MicButton
                  state={recordingState}
                  audioLevel={recorder.audioLevel}
                  onPress={handleMicPress}
                  disabled={backendOnline === false}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
