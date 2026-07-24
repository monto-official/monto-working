"use client";
import { useState, useRef, useCallback, useEffect } from "react";

export const dynamic = "force-dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, X,
  Mic, MicOff, Volume2, Music, ChevronLeft,
  Shuffle, Repeat
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SONGS, type Song } from "@/lib/media-content";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { sendVoiceQuery, APIError } from "@/lib/api";
import { useDeviceChannelContext } from "@/components/DeviceChannelProvider";
import { MiniMonto } from "@/components/MiniMonto";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

const LANG_FLAG: Record<string, string> = { ne: "🇳🇵", hi: "🇮🇳", en: "🇺🇸" };

// ── AudioBars visualiser ──────────────────────────────────────────────────────
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SongsPage() {
  const router = useRouter();
  const { send, lastMessage } = useDeviceChannelContext();

  // Player state
  const [currentIndex, setCurrentIndex]   = useState<number | null>(null);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [progress, setProgress]           = useState(0);
  const [duration, setDuration]           = useState(0);
  const [shuffle, setShuffle]             = useState(true);
  const [repeat, setRepeat]               = useState(false);
  const [volume, setVolume]               = useState(1);

  // Mic / voice state
  const [micOpen, setMicOpen]             = useState(false);
  const [voiceStatus, setVoiceStatus]     = useState<string | null>(null);

  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const recorder  = useAudioRecorder();
  const lastStatusSentAtRef = useRef(0);

  const currentSong: Song | null = currentIndex !== null ? SONGS[currentIndex] : null;

  // ── Report play/pause/stop/track-change state back over the device
  // control channel so the parent app's remote-control UI reflects reality ──
  const sendMusicStatus = useCallback((playing: boolean, song: Song | null, audio: HTMLAudioElement | null) => {
    send({
      type: "music-status",
      playing,
      trackId: song?.id,
      currentTime: audio?.currentTime ?? 0,
      duration: audio?.duration ?? 0,
    });
  }, [send]);

  // ── Play a song by index ───────────────────────────────────────────────────
  const playSong = useCallback((index: number) => {
    const song = SONGS[index];
    if (!song) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const audio = new Audio(`/songs/${encodeURIComponent(song.file)}`);
    audio.volume = volume;
    audioRef.current = audio;

    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate     = () => {
      setProgress(audio.currentTime);
      // Echo status roughly every 5s while playing (not on every timeupdate tick)
      const now = Date.now();
      if (now - lastStatusSentAtRef.current >= 5000) {
        lastStatusSentAtRef.current = now;
        sendMusicStatus(true, song, audio);
      }
    };
    audio.onended          = () => {
      if (repeat) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        const next = shuffle
          ? Math.floor(Math.random() * SONGS.length)
          : index + 1 < SONGS.length ? index + 1 : 0;
        playSong(next);
      }
    };

    audio.play().catch(() => {});
    setCurrentIndex(index);
    setIsPlaying(true);
    setProgress(0);
    lastStatusSentAtRef.current = Date.now();
    sendMusicStatus(true, song, audio);
  }, [volume, shuffle, repeat, sendMusicStatus]);

  // ── Toggle play/pause ──────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      sendMusicStatus(false, currentSong, audioRef.current);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      sendMusicStatus(true, currentSong, audioRef.current);
    }
  }, [isPlaying, currentSong, sendMusicStatus]);

  // ── Stop: pause and reset to the beginning ──────────────────────────────────
  const stopSong = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setProgress(0);
    sendMusicStatus(false, currentSong, audioRef.current);
  }, [currentSong, sendMusicStatus]);
  // Always listen for the single word "cut" while a song is playing.
  useEffect(() => {
    if (!isPlaying || typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let active = true;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let heard = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        heard += ` ${event.results[index][0]?.transcript ?? ""}`;
      }
      if (/(^|\s)cut(?=\s|$|[.!?,])/i.test(heard.trim())) {
        active = false;
        try { recognition.stop(); } catch { /* already stopped */ }
        stopSong();
        setVoiceStatus('Stopped - "cut" detected');
        setTimeout(() => setVoiceStatus(null), 2500);
      }
    };

    recognition.onend = () => {
      if (active) restartTimer = setTimeout(() => {
        try { recognition.start(); } catch { /* browser is restarting */ }
      }, 250);
    };

    try { recognition.start(); } catch { /* microphone unavailable */ }
    return () => {
      active = false;
      if (restartTimer) clearTimeout(restartTimer);
      try { recognition.stop(); } catch { /* already stopped */ }
    };
  }, [isPlaying, stopSong]);

  // ── Skip ──────────────────────────────────────────────────────────────────
  const skip = useCallback((dir: 1 | -1) => {
    if (currentIndex === null) { playSong(0); return; }
    const next = shuffle
      ? Math.floor(Math.random() * SONGS.length)
      : (currentIndex + dir + SONGS.length) % SONGS.length;
    playSong(next);
  }, [currentIndex, shuffle, playSong]);

  // ── Volume ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ── Seek ───────────────────────────────────────────────────────────────────
  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  }, [duration]);

  // ── Voice commands ─────────────────────────────────────────────────────────
  const handleVoice = useCallback(async () => {
    if (recorder.recordingState === "recording") {
      const blob = await recorder.stopRecording();
      if (!blob || blob.size < 500) { setVoiceStatus(null); return; }
      setVoiceStatus("Thinking...");
      try {
        const result = await sendVoiceQuery(blob);
        const t = result.transcript.toLowerCase();
        setVoiceStatus(`"${result.transcript}"`);

        if (/next|skip/.test(t))         skip(1);
        else if (/prev|back/.test(t))    skip(-1);
        else if (/\b(cut|pause|stop)\b/.test(t)) { stopSong(); }
        else if (/play|resume/.test(t))  { audioRef.current?.play().catch(()=>{}); setIsPlaying(true); sendMusicStatus(true, currentSong, audioRef.current); }
        else if (/shuffle/.test(t))      setShuffle(s => !s);
        else if (/repeat|loop/.test(t))  setRepeat(r => !r);
        else {
          // Try to match a song title
          const match = SONGS.findIndex(s =>
            s.title.toLowerCase().includes(t.replace(/play\s*/i,"").trim()) ||
            t.includes(s.title.toLowerCase().split("—")[0].trim())
          );
          if (match >= 0) playSong(match);
        }

        setTimeout(() => setVoiceStatus(null), 3000);
      } catch (err) {
        setVoiceStatus(err instanceof APIError ? err.message : "Error");
        setTimeout(() => setVoiceStatus(null), 2500);
      }
    } else {
      await recorder.startRecording();
    }
  }, [recorder, skip, playSong, sendMusicStatus, currentSong, stopSong]);

  // ── Auto-play requested track (via ?track=) or the first song ──────────
  useEffect(() => {
    const trackId = new URLSearchParams(window.location.search).get("track");
    const requestedIndex = trackId ? SONGS.findIndex(s => s.id === trackId) : -1;
    const initialIndex = requestedIndex >= 0 ? requestedIndex : Math.floor(Math.random() * SONGS.length);
    // Small delay so the audio element is ready after navigation
    const t = setTimeout(() => playSong(initialIndex), 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // ── Remote transport control from the parent app (device control channel) ──
  // Kept in a ref so this single effect (keyed only on `lastMessage`) always
  // calls the *latest* versions of these callbacks without re-subscribing.
  const latestRef = useRef({ playSong, skip, stopSong, sendMusicStatus, currentSong });
  useEffect(() => {
    latestRef.current = { playSong, skip, stopSong, sendMusicStatus, currentSong };
  });

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "music-command") return;
    const { action, trackId } = lastMessage;
    const { playSong: play, skip: doSkip, stopSong: stop, sendMusicStatus: sendStatus, currentSong: song } = latestRef.current;

    if (action === "play") {
      if (trackId) {
        const idx = SONGS.findIndex(s => s.id === trackId);
        if (idx >= 0) { play(idx); return; }
      }
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
        sendStatus(true, song, audioRef.current);
      } else {
        play(0);
      }
    } else if (action === "pause") {
      audioRef.current?.pause();
      setIsPlaying(false);
      sendStatus(false, song, audioRef.current);
    } else if (action === "stop") {
      stop();
    } else if (action === "skip") {
      doSkip(1);
    }
  }, [lastMessage]);

  const isRec = recorder.recordingState === "recording";
  const pct   = duration ? (progress / duration) * 100 : 0;
  const cfg   = currentSong ?? SONGS[0];

  return (
    <div className="min-h-dvh flex flex-col bg-black select-none">

      {/* ── Header ── */}
      <header className="flex flex-col items-center gap-2 px-5 pt-safe pt-5 pb-3">
        <div className="flex items-center gap-2 bg-white/5 rounded-full p-1">
          <motion.button onClick={() => router.back()} whileTap={{ scale: 0.85 }}
            title="Back" aria-label="Back"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-white" />
          </motion.button>
          <motion.button onClick={() => { stopSong(); router.push("/"); }} whileTap={{ scale: 0.85 }}
            title="Close — stop and go home" aria-label="Close — stop and go home"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30">
            <X className="w-5 h-5 text-white" />
          </motion.button>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-base">🎵 Songs</p>
          <p className="text-white/40 text-xs">{SONGS.length} tracks</p>
        </div>
      </header>

      {/* ── Now-playing card ── */}
      <AnimatePresence mode="wait">
        {currentSong && (
          <motion.div key={currentSong.id}
            className="mx-4 mb-4 rounded-3xl p-5"
            style={{ background: `linear-gradient(135deg, ${currentSong.color}25, ${currentSong.color}10)`, border: `1px solid ${currentSong.color}40` }}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          >
            {/* Art + info */}
            <div className="flex items-center gap-4 mb-4">
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 overflow-hidden"
                style={{ background: `${currentSong.color}30` }}
                animate={isPlaying ? { rotate: [0, 5, -5, 0] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {currentSong.thumbnail
                  ? <img src={`/songs/thumbs/${currentSong.thumbnail}`} alt="" className="w-full h-full object-cover" />
                  : currentSong.emoji}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base leading-snug truncate">{currentSong.title}</p>
                <p className="text-white/50 text-sm mt-0.5">{LANG_FLAG[currentSong.lang]} Kids Song</p>
              </div>
              <Volume2 className="w-4 h-4 flex-shrink-0" style={{ color: currentSong.color }} />
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-white/10 rounded-full mb-1 cursor-pointer relative" onClick={seek}>
              <motion.div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{ background: currentSong.color, width: `${pct}%` }}
              />
              {/* Thumb */}
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
                <Shuffle className="w-5 h-5" style={{ color: shuffle ? currentSong.color : "rgba(255,255,255,0.3)" }} />
              </motion.button>

              <motion.button onClick={() => skip(-1)} whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <SkipBack className="w-5 h-5 text-white" />
              </motion.button>

              <motion.button onClick={togglePlay} whileTap={{ scale: 0.9 }}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: currentSong.color, boxShadow: `0 0 30px ${currentSong.color}60` }}>
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
                <Repeat className="w-5 h-5" style={{ color: repeat ? currentSong.color : "rgba(255,255,255,0.3)" }} />
              </motion.button>
            </div>

            {/* Volume slider */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-white/30 text-xs">🔇</span>
              <input type="range" min={0} max={1} step={0.05} value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                className="flex-1 h-1 rounded-full accent-white cursor-pointer"
                style={{ accentColor: currentSong.color }}
              />
              <span className="text-white/30 text-xs">🔊</span>
            </div>
          </motion.div>
        )}

        {/* Idle state */}
        {!currentSong && (
          <motion.div key="idle"
            className="mx-4 mb-4 rounded-3xl p-6 flex flex-col items-center gap-3 bg-white/4 border border-white/8"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <Music className="w-12 h-12 text-white/20" />
            <p className="text-white/40 text-sm">Tap a song to start playing</p>
            <p className="text-white/20 text-xs">or say "play [song name]"</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mic bar ── */}
      <div className="mx-4 mb-3">
        <motion.button onClick={handleVoice}
          className="w-full rounded-2xl py-3 px-4 flex items-center justify-center gap-3"
          style={{
            background: isRec
              ? "linear-gradient(135deg,#EF4444,#DC2626)"
              : `rgba(255,255,255,0.06)`,
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
              <span className="text-white/50 text-sm">Say "cut" anytime to stop the song</span>
            </>
          )}
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

      {/* ── Playlist ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-safe pb-6 space-y-2">
        <p className="text-white/30 text-xs px-1 mb-2 uppercase tracking-wider">Playlist</p>
        {SONGS.map((song, i) => {
          const active = currentIndex === i;
          return (
            <motion.button key={song.id} onClick={() => playSong(i)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl text-left"
              style={{
                background: active ? `${song.color}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? song.color + "50" : "rgba(255,255,255,0.06)"}`,
              }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              {/* Track number / playing indicator */}
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${song.color}20` }}>
                {active && isPlaying ? (
                  <div className="flex items-end gap-0.5 h-4">
                    {[0, 1, 2].map(j => (
                      <motion.div key={j} className="w-0.5 rounded-full"
                        style={{ background: song.color }}
                        animate={{ height: ["30%", "100%", "30%"] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: j * 0.15 }}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-white/30 text-xs font-mono">{(i + 1).toString().padStart(2, "0")}</span>
                )}
              </div>

              {/* Thumbnail (falls back to emoji when the song has no artwork) */}
              {song.thumbnail ? (
                <img src={`/songs/thumbs/${song.thumbnail}`} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <span className="text-2xl flex-shrink-0">{song.emoji}</span>
              )}

              {/* Title */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${active ? "text-white" : "text-white/80"}`}>
                  {song.title}
                </p>
                <p className="text-white/30 text-xs">{LANG_FLAG[song.lang]} Kids Song</p>
              </div>

              {/* Play icon on hover */}
              {!active && (
                <Play className="w-4 h-4 text-white/20 flex-shrink-0" />
              )}
              {active && (
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: song.color }}>
                  {isPlaying ? "Playing" : "Paused"}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      <MiniMonto />
    </div>
  );
}



