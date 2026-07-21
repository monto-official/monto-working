"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Music2, Play, RotateCcw, Snowflake, Star, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { SONGS } from "@/lib/media-content";
import { useTTS } from "@/hooks/useTTS";
import type { Settings } from "@/types";

type Phase = "welcome" | "ready" | "dancing" | "frozen" | "celebrate" | "finished";

type Level = {
  name: string;
  seconds: number;
  color: string;
  pose?: { emoji: string; label: string };
};

const LEVELS: Level[] = [
  { name: "Easy", seconds: 3, color: "#34D399" },
  { name: "Medium", seconds: 5, color: "#38BDF8" },
  { name: "Hard", seconds: 10, color: "#A78BFA" },
  { name: "Expert", seconds: 10, color: "#FB7185", pose: { emoji: "🦩", label: "Flamingo" } },
  { name: "Expert", seconds: 10, color: "#F59E0B", pose: { emoji: "🤖", label: "Robot" } },
  { name: "Expert", seconds: 10, color: "#22C55E", pose: { emoji: "🦖", label: "Dinosaur" } },
];

const MOVES = ["💃 Dance", "🕺 Wiggle", "🦘 Hop", "👏 Clap", "🤸 Spin", "🐰 Bounce"];
const ENCOURAGEMENTS = [
  "[excited]\nWow! Nice dancing!",
  "[happy]\nCan you jump even higher?",
  "[friendly]\nShow me your funniest dance!",
  "[excited]\nAmazing moves! Keep going!",
];
const PRAISE = [
  "[happy]\nAmazing! You have superhero control!",
  "[happy]\nExcellent balance!",
  "[excited]\nYou earned one Ice Star!",
];
const TTS_SETTINGS: Settings = { language: "english", voice: "female", autoSpeak: true, darkMode: true };

export default function FreezeDancePage() {
  const router = useRouter();
  const { speak, cancel } = useTTS();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [round, setRound] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [stars, setStars] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [message, setMessage] = useState("Ready to move, laugh, and freeze?");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const level = LEVELS[Math.min(round, LEVELS.length - 1)];

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const say = useCallback((text: string, emotion = "excited") => {
    void speak(text, emotion, TTS_SETTINGS);
  }, [speak]);

  const stopEverything = useCallback(() => {
    clearTimers();
    cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, [cancel, clearTimers]);

  useEffect(() => stopEverything, [stopEverything]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const timer = setTimeout(fn, delay);
    timersRef.current.push(timer);
  }, []);

  const freeze = useCallback(() => {
    clearTimers();
    audioRef.current?.pause();
    setPhase("frozen");
    setCountdown(level.seconds);
    setMessage(level.pose ? `Freeze like a ${level.pose.label}!` : "Don't move at all!");
    say(`[excited]\nFREEZE!${level.pose ? ` Freeze like a ${level.pose.label}!` : ""}`, "excited");

    let remaining = level.seconds;
    const tick = () => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining > 0) {
        say(`[calm]\n${remaining}`, "neutral");
        schedule(tick, 1000);
      } else {
        const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
        setStars(value => value + 1);
        setPhase("celebrate");
        setMessage(praise.replace(/^\[[^\]]+\]\s*/, ""));
        say(praise, "happy");
        schedule(() => {
          if (round + 1 >= LEVELS.length) {
            setPhase("finished");
            setMessage("Freeze Dance Champion!");
            say("[excited]\nFantastic! You are the Freeze Dance Champion!", "excited");
          } else {
            setRound(value => value + 1);
            setPhase("ready");
            setMessage("Ready for a harder round?");
          }
        }, 2600);
      }
    };
    schedule(tick, 1000);
  }, [clearTimers, level, round, say, schedule]);

  const startDance = useCallback(() => {
    clearTimers();
    cancel();
    setPhase("dancing");
    setMessage("Dance any way you like!");
    setMoveIndex(Math.floor(Math.random() * MOVES.length));

    const song = SONGS.find(item => item.id === "s5") ?? SONGS[0];
    const audio = new Audio(`/songs/${encodeURIComponent(song.file)}`);
    audio.loop = true;
    audio.volume = 0.72;
    audioRef.current = audio;
    void audio.play();

    const danceMs = 8000 + Math.floor(Math.random() * 6000);
    schedule(() => {
      const encouragement = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
      setMessage(encouragement.replace(/^\[[^\]]+\]\s*/, ""));
      setMoveIndex(Math.floor(Math.random() * MOVES.length));
      say(encouragement, "excited");
    }, Math.max(3000, danceMs - 4500));
    schedule(freeze, danceMs);
  }, [cancel, clearTimers, freeze, round, say, schedule]);

  const begin = () => {
    setPhase("ready");
    setMessage("Dance when music plays. Stop when Monto says FREEZE!");
    say("[excited]\nHey! Are you ready for a Freeze Dance Party? When the music plays, dance as much as you want. But when I say FREEZE, don't move at all!", "excited");
  };

  const restart = () => {
    stopEverything();
    setRound(0);
    setStars(0);
    setCountdown(3);
    setPhase("welcome");
    setMessage("Ready to move, laugh, and freeze?");
  };

  const leave = () => {
    stopEverything();
    router.push("/");
  };

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#07111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,.3),transparent_30%),radial-gradient(circle_at_85%_80%,rgba(168,85,247,.3),transparent_34%),linear-gradient(160deg,#07111f,#111c3a)]" />
      {Array.from({ length: 16 }, (_, i) => (
        <motion.span key={i} className="absolute text-white/20 select-none" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 61) % 100}%`, fontSize: 14 + (i % 4) * 7 }} animate={{ y: [0, -18, 0], rotate: [0, 18, 0] }} transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: i * .13 }}>❄</motion.span>
      ))}

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <button onClick={leave} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Back"><ArrowLeft /></button>
          <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.28em] text-cyan-200/70">Monto</p><h1 className="font-kids text-xl font-black">Freeze Dance Party</h1></div>
          <div className="flex h-11 items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 font-black text-amber-200"><Star className="h-4 w-4 fill-current" />{stars}</div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-7 text-center">
          <div className="mb-5 flex gap-2">
            {LEVELS.map((item, index) => <span key={index} className="h-2.5 w-8 rounded-full transition-all" style={{ background: index <= round ? item.color : "rgba(255,255,255,.12)", boxShadow: index === round ? `0 0 16px ${item.color}` : "none" }} />)}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={phase + round} initial={{ opacity: 0, scale: .85, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.1 }} className="w-full">
              <div className={`mx-auto flex h-56 w-56 items-center justify-center rounded-[4rem] border sm:h-64 sm:w-64 ${phase === "frozen" ? "border-cyan-200/60 bg-cyan-300/20 shadow-[0_0_80px_rgba(34,211,238,.35)]" : "border-white/10 bg-white/10 shadow-2xl"}`}>
                {phase === "welcome" && <motion.div animate={{ rotate: [-5, 5, -5], scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.3 }} className="text-8xl">🎵</motion.div>}
                {phase === "ready" && <div><Music2 className="mx-auto h-20 w-20 text-fuchsia-300" /><p className="mt-3 font-black" style={{ color: level.color }}>{level.name} · {level.seconds}s freeze</p></div>}
                {phase === "dancing" && <motion.div animate={{ rotate: [-14, 14, -10, 10, 0], y: [0, -18, 0] }} transition={{ repeat: Infinity, duration: .75 }} className="text-8xl">{MOVES[moveIndex].split(" ")[0]}</motion.div>}
                {phase === "frozen" && <div>{level.pose && <div className="mb-1 text-7xl">{level.pose.emoji}</div>}<motion.div initial={{ scale: 1.7 }} animate={{ scale: 1 }} className="text-7xl font-black text-cyan-100">{countdown}</motion.div><Snowflake className="mx-auto mt-2 text-cyan-200" /></div>}
                {phase === "celebrate" && <motion.div animate={{ scale: [1, 1.25, 1], rotate: [-8, 8, 0] }} transition={{ repeat: Infinity, duration: .7 }} className="text-8xl">⭐</motion.div>}
                {phase === "finished" && <Trophy className="h-28 w-28 text-amber-300" />}
              </div>

              <p className="mt-7 text-xs font-black uppercase tracking-[.3em]" style={{ color: phase === "frozen" ? "#A5F3FC" : level.color }}>{phase === "dancing" ? MOVES[moveIndex] : phase === "frozen" ? "FREEZE!" : level.name}</p>
              <h2 className="mx-auto mt-3 max-w-lg text-2xl font-black leading-tight sm:text-4xl">{message}</h2>
              {phase === "frozen" && <p className="mt-3 text-sm text-cyan-100/60">Keep your body still. Smiling is allowed!</p>}
            </motion.div>
          </AnimatePresence>
        </section>

        <div className="mx-auto w-full max-w-md pb-3">
          {phase === "welcome" && <motion.button whileTap={{ scale: .96 }} onClick={begin} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-lg font-black shadow-[0_18px_45px_rgba(34,211,238,.25)]"><Play className="fill-current" /> Yes, I'm ready!</motion.button>}
          {phase === "ready" && <motion.button whileTap={{ scale: .96 }} onClick={startDance} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl text-lg font-black text-slate-950 shadow-xl" style={{ background: level.color }}><Music2 /> Start round {round + 1}</motion.button>}
          {phase === "dancing" && <button onClick={freeze} className="h-14 w-full rounded-3xl border border-white/10 bg-white/10 font-bold text-white/70">Freeze now</button>}
          {phase === "frozen" && <div className="h-14 text-center text-sm font-bold text-cyan-100/60">Hold that pose…</div>}
          {phase === "celebrate" && <div className="h-14 text-center font-black text-amber-200">Ice Star earned! ⭐</div>}
          {phase === "finished" && <motion.button whileTap={{ scale: .96 }} onClick={restart} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-amber-300 to-orange-400 text-lg font-black text-slate-950"><RotateCcw /> Play again</motion.button>}
          <p className="mt-4 text-center text-[11px] text-white/35">Move safely · Keep space around you · Stop if anything hurts</p>
        </div>
      </div>
    </main>
  );
}
