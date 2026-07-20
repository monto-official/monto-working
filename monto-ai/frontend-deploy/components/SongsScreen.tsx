"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, X, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { SONGS, type Song } from "@/lib/media-content";

interface SongsScreenProps {
  onClose: () => void;
}

export function SongsScreen({ onClose }: SongsScreenProps) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [progress, setProgress]       = useState(0);
  const [duration, setDuration]       = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((song: Song) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(`/songs/${encodeURIComponent(song.file)}`);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate    = () => setProgress(audio.currentTime);
    audio.onended         = () => {
      setIsPlaying(false);
      // Auto-play next
      const idx = SONGS.findIndex(s => s.id === song.id);
      if (idx < SONGS.length - 1) play(SONGS[idx + 1]);
    };
    audio.play().catch(() => {});
    setCurrentSong(song);
    setIsPlaying(true);
    setProgress(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else           { audioRef.current.play().catch(()=>{}); setIsPlaying(true); }
  }, [isPlaying]);

  const skip = useCallback((dir: 1 | -1) => {
    if (!currentSong) return;
    const idx = SONGS.findIndex(s => s.id === currentSong.id);
    const next = SONGS[idx + dir];
    if (next) play(next);
  }, [currentSong, play]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const fmt = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-5 pb-3">
        <motion.button onClick={onClose} whileTap={{ scale: 0.85 }}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <X className="w-4 h-4 text-white" />
        </motion.button>
        <div className="text-center">
          <p className="text-white font-bold text-lg">🎵 Songs</p>
          <p className="text-white/40 text-xs">{SONGS.length} songs</p>
        </div>
        <div className="w-9" />
      </div>

      {/* Now playing mini bar */}
      <AnimatePresence>
        {currentSong && (
          <motion.div
            className="mx-4 mb-3 rounded-2xl p-4"
            style={{ background: `linear-gradient(135deg, ${currentSong.color}30, ${currentSong.color}15)`, border: `1px solid ${currentSong.color}40` }}
            initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <motion.div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: `${currentSong.color}30` }}
                animate={isPlaying ? { scale:[1,1.08,1] } : {}}
                transition={{ duration:0.8, repeat:Infinity }}
              >
                {currentSong.emoji}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{currentSong.title}</p>
                <p className="text-white/50 text-xs">{currentSong.lang === "ne" ? "Nepali" : currentSong.lang === "hi" ? "Hindi" : "English"}</p>
              </div>
              <Volume2 className="w-4 h-4" style={{ color: currentSong.color }} />
            </div>

            {/* Progress bar */}
            <div className="relative h-1.5 bg-white/10 rounded-full mb-2 cursor-pointer"
              onClick={(e) => {
                if (!audioRef.current) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                audioRef.current.currentTime = pct * duration;
              }}
            >
              <motion.div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{ background: currentSong.color, width: `${duration ? (progress/duration)*100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-white/30 text-[10px]">
              <span>{fmt(progress)}</span><span>{fmt(duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6 mt-3">
              <motion.button onClick={() => skip(-1)} whileTap={{ scale:0.85 }}>
                <SkipBack className="w-5 h-5 text-white/60" />
              </motion.button>
              <motion.button onClick={togglePlay} whileTap={{ scale:0.9 }}
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: currentSong.color }}>
                {isPlaying
                  ? <Pause className="w-5 h-5 text-white" />
                  : <Play  className="w-5 h-5 text-white ml-0.5" />
                }
              </motion.button>
              <motion.button onClick={() => skip(1)} whileTap={{ scale:0.85 }}>
                <SkipForward className="w-5 h-5 text-white/60" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playlist */}
      <div className="flex-1 overflow-y-auto px-4 pb-safe pb-6 space-y-2">
        {SONGS.map((song, i) => {
          const active = currentSong?.id === song.id;
          return (
            <motion.button key={song.id} onClick={() => play(song)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl text-left"
              style={{
                background: active ? `${song.color}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? song.color+"50" : "rgba(255,255,255,0.06)"}`,
              }}
              whileTap={{ scale:0.97 }}
              initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }}
              transition={{ delay: i*0.04 }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: `${song.color}25` }}>
                {active && isPlaying
                  ? <motion.div animate={{ scale:[1,1.2,1] }} transition={{ duration:0.5, repeat:Infinity }}>
                      {song.emoji}
                    </motion.div>
                  : song.emoji
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate ${active ? "text-white" : "text-white/80"}`}>
                  {song.title}
                </p>
                <p className="text-white/40 text-xs">{song.lang === "ne" ? "Nepali" : song.lang === "hi" ? "Hindi" : "English"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/30 text-xs">♪</span>
                {active && isPlaying && (
                  <div className="flex items-end gap-0.5 h-4">
                    {[0,1,2].map(j => (
                      <motion.div key={j} className="w-0.5 rounded-full"
                        style={{ background: song.color }}
                        animate={{ height:["40%","100%","40%"] }}
                        transition={{ duration:0.5, repeat:Infinity, delay:j*0.15 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}



