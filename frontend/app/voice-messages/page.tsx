"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Mic, Square, Play, Pause, Voicemail, Heart, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useDeviceChannelContext } from "@/components/DeviceChannelProvider";
import { getApiUrl } from "@/lib/api-url";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { MiniMonto } from "@/components/MiniMonto";

const API_URL = getApiUrl();

interface VoiceMessage {
  id: string;
  sender_role: "parent" | "child";
  duration_ms: number | null;
  mime_type: string;
  created_at: string;
  listened_at: string | null;
}

function fmtDuration(ms: number | null): string {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// -- Recording level bars ------------------------------------------------------
function AudioBars({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5 h-6">
      {Array.from({ length: 10 }, (_, i) => {
        const h = Math.max(3, (Math.sin(i * 0.8) * 0.5 + 0.5) * 20 * level + 3);
        return (
          <motion.div key={i} className="w-1 rounded-full bg-white"
            animate={{ height: [3, h, 3] }} transition={{ duration: 0.4, delay: i * 0.04, repeat: Infinity, ease: "easeInOut" }} />
        );
      })}
    </div>
  );
}

export default function VoiceMessagesPage() {
  const router = useRouter();
  const { send, lastMessage } = useDeviceChannelContext();
  const recorder = useAudioRecorder();
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  const [list, setList] = useState<VoiceMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const startedAtRef = useRef(0);
  const busyRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/voice-messages/${deviceId}`, { cache: "no-store" });
      if (res.ok) setList(await res.json());
    } catch {
      // Silent: keep the last successfully loaded list.
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Live-refresh the list the instant a new note (either direction) lands
  // while this screen is open.
  useEffect(() => {
    if (lastMessage?.type === "voice-message") void refresh();
  }, [lastMessage, refresh]);

  // Never leave a message playing in the background once the child leaves.
  useEffect(() => () => {
    audioRef.current?.pause();
    recorder.cancelRecording();
  }, [recorder.cancelRecording]);

  const handleTap = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      if (recorder.recordingState === "recording") {
        const blob = await recorder.stopRecording();
        if (!blob || blob.size < 800) return;
        setSending(true);
        setError(null);
        try {
          const form = new FormData();
          const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "mp4" : "webm";
          form.append("audio", blob, `note.${ext}`);
          form.append("sender_role", "child");
          form.append("duration_ms", String(Math.min(30000, Math.round(performance.now() - startedAtRef.current))));

          const res = await fetch(`${API_URL}/voice-messages/${deviceId}`, { method: "POST", body: form });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json() as { id: string };
          send({ type: "voice-message", id: data.id, senderRole: "child" });
          await refresh();
        } catch {
          setError("Could not send. Please try again.");
          setTimeout(() => setError(null), 3000);
        } finally {
          setSending(false);
        }
      } else {
        setError(null);
        startedAtRef.current = performance.now();
        await recorder.startRecording();
      }
    } finally {
      busyRef.current = false;
    }
  }, [recorder, send, deviceId, refresh]);

  const play = useCallback((message: VoiceMessage) => {
    if (playingId === message.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(`${API_URL}/voice-messages/${deviceId}/${message.id}/audio`);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    setPlayingId(message.id);
    void audio.play().catch(() => setPlayingId(null));
  }, [playingId, deviceId]);

  const isRec = recorder.recordingState === "recording";

  return (
    <div className="min-h-dvh flex flex-col bg-black select-none overflow-hidden relative">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(168,85,247,.16),transparent_32%),radial-gradient(circle_at_88%_82%,rgba(124,58,237,.18),transparent_34%)]" />
      {["💜", "✨", "💬", "🎤"].map((item, index) => (
        <motion.span
          key={item}
          className="pointer-events-none absolute select-none text-3xl opacity-10"
          style={{ left: `${10 + index * 24}%`, top: `${14 + (index % 2) * 60}%` }}
          animate={{ y: [0, -14, 0], rotate: [-8, 8, -8] }}
          transition={{ duration: 3 + index * .4, repeat: Infinity }}
        >
          {item}
        </motion.span>
      ))}

      {/* Header */}
      <header className="relative z-10 flex flex-col items-center gap-2 px-5 pt-safe pt-5 pb-3">
        <div className="flex items-center gap-2 bg-white/5 rounded-full p-1">
          <motion.button onClick={() => router.back()} whileTap={{ scale: 0.85 }}
            title="Back" aria-label="Back"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-white" />
          </motion.button>
          <motion.button onClick={() => router.push("/")} whileTap={{ scale: 0.85 }}
            title="Close" aria-label="Close"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </motion.button>
        </div>
        <div className="text-center">
          <p className="text-white font-black text-lg">💌 Voice Messages</p>
          <p className="text-white/40 text-xs">Stay close with your family</p>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: .95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", bounce: .4 }}
        className="relative z-10 mx-4 mb-4 rounded-3xl p-6 flex flex-col items-center gap-3"
        style={{ background: "linear-gradient(135deg, #7C3AED25, #A855F710)", border: "1px solid #A855F740" }}
      >
        <div className="relative flex items-center justify-center">
          <AnimatePresence>
            {isRec && [1, 2, 3].map(i => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-red-500"
                initial={{ width: 88, height: 88, opacity: 0.5 }}
                animate={{ width: [88, 88 + i * 34 + recorder.audioLevel * 30], height: [88, 88 + i * 34 + recorder.audioLevel * 30], opacity: [0.4, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * .35, ease: "easeOut" }}
              />
            ))}
          </AnimatePresence>
          <motion.button
            onClick={handleTap}
            disabled={sending}
            aria-pressed={isRec}
            aria-label={isRec ? "Tap to send your message" : "Tap to record a voice message"}
            whileHover={!sending ? { scale: 1.06 } : {}}
            whileTap={!sending ? { scale: 0.92 } : {}}
            animate={!isRec && !sending ? { scale: [1, 1.05, 1] } : {}}
            transition={!isRec && !sending ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
            className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-lg disabled:opacity-50"
            style={{
              background: isRec ? "linear-gradient(135deg,#EF4444,#DC2626)" : "linear-gradient(135deg,#7C3AED,#A855F7)",
              boxShadow: isRec ? "0 0 30px rgba(239,68,68,0.5)" : "0 0 30px rgba(124,58,237,0.5)",
            }}
          >
            <AnimatePresence mode="wait">
              {isRec ? (
                <motion.div key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Square className="w-8 h-8 text-white fill-white" />
                </motion.div>
              ) : (
                <motion.div key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Mic className="w-8 h-8 text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {isRec && <AudioBars level={recorder.audioLevel} />}

        <p className="text-white/70 text-sm font-bold">
          {sending ? "Sending…" : isRec ? "Tap to send 💜" : "Tap to leave a message!"}
        </p>
        <AnimatePresence>
          {(error || recorder.error) && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-rose-300 text-xs">{error || recorder.error}</motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* History */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-6 space-y-2.5">
        {loading && <p className="text-white/30 text-sm text-center py-8">Loading messages...</p>}
        {!loading && list.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-10 text-center">
            <motion.div animate={{ y: [0, -8, 0], rotate: [-6, 6, -6] }} transition={{ duration: 2.4, repeat: Infinity }}>
              <Voicemail className="w-12 h-12 text-white/15" />
            </motion.div>
            <p className="text-white/30 text-sm">No messages yet — send the first one!</p>
          </motion.div>
        )}
        <AnimatePresence initial={false}>
          {list.slice().reverse().map((m, i) => (
            <motion.div key={m.id}
              initial={{ opacity: 0, y: 16, scale: .95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ type: "spring", bounce: .35, delay: Math.min(i, 4) * .04 }}
              className="rounded-2xl bg-white/[.06] border border-white/10 p-3.5 flex items-center gap-3"
            >
              <div className={
                "w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 " +
                (m.sender_role === "parent" ? "bg-gradient-to-br from-violet-500 to-fuchsia-400" : "bg-white/10")
              }>
                {m.sender_role === "parent" ? <Heart className="w-5 h-5 text-white" /> : <Voicemail className="w-5 h-5 text-white/70" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">
                  {m.sender_role === "parent" ? "From your parent" : "You sent"}
                </p>
                <p className="text-white/40 text-xs mt-0.5">{fmtTime(m.created_at)}{m.duration_ms ? ` - ${fmtDuration(m.duration_ms)}` : ""}</p>
              </div>
              <motion.button onClick={() => play(m)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                animate={playingId === m.id ? { scale: [1, 1.1, 1] } : {}}
                transition={playingId === m.id ? { duration: .6, repeat: Infinity } : {}}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}>
                {playingId === m.id ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <MiniMonto />
    </div>
  );
}
