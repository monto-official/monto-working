"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward,
  Mic, Volume2, BookOpen, ChevronLeft,
  Shuffle, Repeat
} from "lucide-react";
import { useRouter } from "next/navigation";
import { STORIES, type Story } from "@/lib/media-content";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { sendVoiceQuery, APIError } from "@/lib/api";
import { useDeviceChannelContext } from "@/components/DeviceChannelProvider";

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

const LANG_FLAG: Record<string, string> = { ne: "🇳🇵", hi: "🇮🇳", en: "🇺🇸" };

function AudioBars({ level, color }: { level: number; color: string }) {
  return (
    <div className="flex items-center gap-0.5 h-6">
      {Array.from({ length: 10 }, (_, i) => {
        const h = Math.max(3, (Math.sin(i * 0.8) * 0.5 + 0.5) * 20 * level + 3);
        return (
          <motion.div key={i} className="w-1 rounded-full"
            style={{ background: color }}
            animate={{ height: [3, h, 3] }}
            transition={{ duration: 0.35, delay: i * 0.04, repeat: Infinity, ease: "easeInOut" }}
          />
        );
      })}
    </div>
  );
}

export default function StoriesPage() {
  const router = useRouter();
  const { send, lastMessage } = useDeviceChannelContext();

  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [progress, setProgress]         = useState(0);
  const [duration, setDuration]         = useState(0);
  const [shuffle, setShuffle]           = useState(false);
  const [repeat, setRepeat]             = useState(false);
  const [volume, setVolume]             = useState(1);
  const [voiceStatus, setVoiceStatus]   = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorder = useAudioRecorder();
  const lastStatusSentAtRef = useRef(0);

  const currentStory: Story | null = currentIndex !== null ? STORIES[currentIndex] : null;

  // ── Report play/pause/stop/track-change state back over the device
  // control channel so the parent app's remote-control UI reflects reality ──
  const sendStoryStatus = useCallback((playing: boolean, story: Story | null, audio: HTMLAudioElement | null) => {
    send({
      type: "story-status",
      playing,
      trackId: story?.id,
      currentTime: audio?.currentTime ?? 0,
      duration: audio?.duration ?? 0,
    });
  }, [send]);

  const playStory = useCallback((index: number) => {
    const story = STORIES[index];
    if (!story) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const audio = new Audio(`/stories/${encodeURIComponent(story.file)}`);
    audio.volume = volume;
    audioRef.current = audio;

    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate     = () => {
      setProgress(audio.currentTime);
      const now = Date.now();
      if (now - lastStatusSentAtRef.current >= 5000) {
        lastStatusSentAtRef.current = now;
        sendStoryStatus(true, story, audio);
      }
    };
    audio.onended          = () => {
      if (repeat) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        const next = shuffle
          ? Math.floor(Math.random() * STORIES.length)
          : index + 1 < STORIES.length ? index + 1 : 0;
        playStory(next);
      }
    };

    audio.play().catch(() => {});
    setCurrentIndex(index);
    setIsPlaying(true);
    setProgress(0);
    lastStatusSentAtRef.current = Date.now();
    sendStoryStatus(true, story, audio);
  }, [volume, shuffle, repeat, sendStoryStatus]);

  const stopStory = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setProgress(0);
    sendStoryStatus(false, currentStory, audioRef.current);
  }, [currentStory, sendStoryStatus]);

  // Auto-play the requested story (via ?track=) or the first one
  useEffect(() => {
    const trackId = new URLSearchParams(window.location.search).get("track");
    const requestedIndex = trackId ? STORIES.findIndex(s => s.id === trackId) : -1;
    const initialIndex = requestedIndex >= 0 ? requestedIndex : 0;
    const t = setTimeout(() => playStory(initialIndex), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      sendStoryStatus(false, currentStory, audioRef.current);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      sendStoryStatus(true, currentStory, audioRef.current);
    }
  }, [isPlaying, currentStory, sendStoryStatus]);

  const skip = useCallback((dir: 1 | -1) => {
    if (currentIndex === null) { playStory(0); return; }
    const next = shuffle
      ? Math.floor(Math.random() * STORIES.length)
      : (currentIndex + dir + STORIES.length) % STORIES.length;
    playStory(next);
  }, [currentIndex, shuffle, playStory]);

  // ── Remote transport control from the parent app (device control channel) ──
  const latestRef = useRef({ playStory, skip, stopStory, sendStoryStatus, currentStory });
  useEffect(() => {
    latestRef.current = { playStory, skip, stopStory, sendStoryStatus, currentStory };
  });

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "story-command") return;
    const { action, trackId } = lastMessage;
    const { playStory: play, skip: doSkip, stopStory: stop, sendStoryStatus: sendStatus, currentStory: story } = latestRef.current;

    if (action === "play") {
      if (trackId) {
        const idx = STORIES.findIndex(s => s.id === trackId);
        if (idx >= 0) { play(idx); return; }
      }
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
        sendStatus(true, story, audioRef.current);
      } else {
        play(0);
      }
    } else if (action === "pause") {
      audioRef.current?.pause();
      setIsPlaying(false);
      sendStatus(false, story, audioRef.current);
    } else if (action === "stop") {
      stop();
    } else if (action === "skip") {
      doSkip(1);
    }
  }, [lastMessage]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  }, [duration]);

  const handleVoice = useCallback(async () => {
    if (recorder.recordingState === "recording") {
      const blob = await recorder.stopRecording();
      if (!blob || blob.size < 500) { setVoiceStatus(null); return; }
      setVoiceStatus("Thinking...");
      try {
        const result = await sendVoiceQuery(blob);
        const t = result.transcript.toLowerCase();
        setVoiceStatus(`"${result.transcript}"`);

        if (/next|skip/.test(t))        skip(1);
        else if (/prev|back/.test(t))   skip(-1);
        else if (/pause|stop/.test(t))  { audioRef.current?.pause(); setIsPlaying(false); }
        else if (/play|resume/.test(t)) { audioRef.current?.play().catch(()=>{}); setIsPlaying(true); }
        else if (/shuffle/.test(t))     setShuffle(s => !s);
        else if (/repeat|loop/.test(t)) setRepeat(r => !r);
        else {
          const match = STORIES.findIndex(s =>
            s.title.toLowerCase().includes(t.replace(/play\s*/i, "").trim()) ||
            t.includes(s.title.toLowerCase().split("(")[0].trim())
          );
          if (match >= 0) playStory(match);
        }
        setTimeout(() => setVoiceStatus(null), 3000);
      } catch (err) {
        setVoiceStatus(err instanceof APIError ? err.message : "Error");
        setTimeout(() => setVoiceStatus(null), 2500);
      }
    } else {
      await recorder.startRecording();
    }
  }, [recorder, skip, playStory]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const isRec = recorder.recordingState === "recording";
  const pct   = duration ? (progress / duration) * 100 : 0;

  return (
    <div className="min-h-dvh flex flex-col bg-black select-none">

      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-safe pt-5 pb-3">
        <motion.button onClick={() => router.back()} whileTap={{ scale: 0.85 }}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-white" />
        </motion.button>
        <div className="text-center">
          <p className="text-white font-bold text-xl">📖 Stories</p>
          <p className="text-white/40 text-xs">{STORIES.length} stories</p>
        </div>
        <div className="w-10" />
      </header>

      {/* Now-playing card */}
      <AnimatePresence mode="wait">
        {currentStory && (
          <motion.div key={currentStory.id}
            className="mx-4 mb-4 rounded-3xl p-5"
            style={{ background: `linear-gradient(135deg, ${currentStory.color}25, ${currentStory.color}10)`, border: `1px solid ${currentStory.color}40` }}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-4 mb-4">
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 overflow-hidden"
                style={{ background: `${currentStory.color}30` }}
                animate={isPlaying ? { scale: [1, 1.06, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {currentStory.thumbnail
                  ? <img src={`/stories/thumbs/${currentStory.thumbnail}`} alt="" className="w-full h-full object-cover" />
                  : currentStory.emoji}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base leading-snug truncate">{currentStory.title}</p>
                <p className="text-white/50 text-sm mt-0.5">{LANG_FLAG[currentStory.lang]} Kids Story</p>
              </div>
              <Volume2 className="w-4 h-4 flex-shrink-0" style={{ color: currentStory.color }} />
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-white/10 rounded-full mb-1 cursor-pointer relative" onClick={seek}>
              <motion.div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{ background: currentStory.color, width: `${pct}%` }}
              />
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow"
                style={{ left: `calc(${pct}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-white/30 text-xs mb-4">
              <span>{fmt(progress)}</span><span>{fmt(duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <motion.button onClick={() => setShuffle(s => !s)} whileTap={{ scale: 0.85 }}>
                <Shuffle className="w-5 h-5" style={{ color: shuffle ? currentStory.color : "rgba(255,255,255,0.3)" }} />
              </motion.button>
              <motion.button onClick={() => skip(-1)} whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <SkipBack className="w-5 h-5 text-white" />
              </motion.button>
              <motion.button onClick={togglePlay} whileTap={{ scale: 0.9 }}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: currentStory.color, boxShadow: `0 0 30px ${currentStory.color}60` }}>
                {isPlaying
                  ? <Pause className="w-6 h-6 text-white" />
                  : <Play  className="w-6 h-6 text-white ml-1" />
                }
              </motion.button>
              <motion.button onClick={() => skip(1)} whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <SkipForward className="w-5 h-5 text-white" />
              </motion.button>
              <motion.button onClick={() => setRepeat(r => !r)} whileTap={{ scale: 0.85 }}>
                <Repeat className="w-5 h-5" style={{ color: repeat ? currentStory.color : "rgba(255,255,255,0.3)" }} />
              </motion.button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-white/30 text-xs">🔇</span>
              <input type="range" min={0} max={1} step={0.05} value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                className="flex-1 h-1 rounded-full cursor-pointer"
                style={{ accentColor: currentStory.color }}
              />
              <span className="text-white/30 text-xs">🔊</span>
            </div>
          </motion.div>
        )}

        {!currentStory && (
          <motion.div key="idle"
            className="mx-4 mb-4 rounded-3xl p-6 flex flex-col items-center gap-3 bg-white/4 border border-white/8"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <BookOpen className="w-12 h-12 text-white/20" />
            <p className="text-white/40 text-sm">Tap a story to start listening</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mic bar */}
      <div className="mx-4 mb-3">
        <motion.button onClick={handleVoice}
          className="w-full rounded-2xl py-3 px-4 flex items-center justify-center gap-3"
          style={{
            background: isRec ? "linear-gradient(135deg,#EF4444,#DC2626)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${isRec ? "#EF4444" : "rgba(255,255,255,0.1)"}`,
            boxShadow: isRec ? "0 0 20px rgba(239,68,68,0.4)" : "none",
          }}
          whileTap={{ scale: 0.97 }}
        >
          {isRec ? (
            <>
              <AudioBars level={recorder.audioLevel} color="#fff" />
              <span className="text-white text-sm font-medium">Listening...</span>
              <AudioBars level={recorder.audioLevel} color="#fff" />
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-white/60" />
              <span className="text-white/50 text-sm">Say "next", "pause", or a story name</span>
            </>
          )}
        </motion.button>
        <AnimatePresence>
          {voiceStatus && (
            <motion.p className="text-center text-xs text-white/50 mt-2"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {voiceStatus}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Story playlist */}
      <div className="flex-1 overflow-y-auto px-4 pb-safe pb-6 space-y-2">
        <p className="text-white/30 text-xs px-1 mb-2 uppercase tracking-wider">Playlist</p>
        {STORIES.map((story, i) => {
          const active = currentIndex === i;
          return (
            <motion.button key={story.id} onClick={() => playStory(i)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl text-left"
              style={{
                background: active ? `${story.color}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? story.color + "50" : "rgba(255,255,255,0.06)"}`,
              }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${story.color}20` }}>
                {active && isPlaying ? (
                  <div className="flex items-end gap-0.5 h-4">
                    {[0, 1, 2].map(j => (
                      <motion.div key={j} className="w-0.5 rounded-full"
                        style={{ background: story.color }}
                        animate={{ height: ["30%", "100%", "30%"] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: j * 0.15 }}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-white/30 text-xs font-mono">{(i + 1).toString().padStart(2, "0")}</span>
                )}
              </div>

              {story.thumbnail ? (
                <img src={`/stories/thumbs/${story.thumbnail}`} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <span className="text-2xl flex-shrink-0">{story.emoji}</span>
              )}

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${active ? "text-white" : "text-white/80"}`}>
                  {story.title}
                </p>
                <p className="text-white/30 text-xs">{LANG_FLAG[story.lang]} Kids Story</p>
              </div>

              {!active && <Play className="w-4 h-4 text-white/20 flex-shrink-0" />}
              {active && (
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: story.color }}>
                  {isPlaying ? "Playing" : "Paused"}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
