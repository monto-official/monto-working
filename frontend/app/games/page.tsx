"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Gamepad2, Snowflake, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";

const GAMES = [
  {
    title: "Freeze Dance Party",
    subtitle: "Dance, listen, and freeze!",
    route: "/freeze-dance",
    icon: Snowflake,
    emoji: "💃",
    gradient: "from-cyan-400 via-blue-500 to-violet-600",
    glow: "rgba(56,189,248,.32)",
    skills: ["Movement", "Listening", "Self-control"],
  },
  {
    title: "Sound Challenge",
    subtitle: "Name animals and copy their sounds!",
    route: "/sound-challenge",
    icon: Volume2,
    emoji: "🐄",
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    glow: "rgba(52,211,153,.3)",
    skills: ["Animals", "Speaking", "Imagination"],
  },
];

export default function GamesPage() {
  const router = useRouter();

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#07111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(168,85,247,.25),transparent_34%),radial-gradient(circle_at_88%_85%,rgba(34,211,238,.2),transparent_32%),linear-gradient(155deg,#07111f,#151431)]" />
      {["🎮", "⭐", "🎯", "✨", "🏆", "🎲"].map((item, index) => (
        <motion.span key={index} className="absolute select-none text-4xl opacity-10" style={{ left: `${8 + index * 17}%`, top: `${12 + (index * 29) % 72}%` }} animate={{ y: [0, -15, 0], rotate: [-6, 8, -6] }} transition={{ duration: 3 + index * .3, repeat: Infinity }}>{item}</motion.span>
      ))}

      <div className="relative z-10 mx-auto min-h-[100dvh] w-full max-w-3xl px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <button onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Back"><ArrowLeft /></button>
          <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.28em] text-violet-200/70">Monto</p><h1 className="font-kids text-xl font-black">Play Games</h1></div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-300/20 bg-violet-300/10"><Gamepad2 className="h-5 w-5 text-violet-200" /></div>
        </header>

        <section className="py-12 text-center sm:py-16">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs font-black uppercase tracking-[.3em] text-cyan-200/55">Choose your adventure</p>
            <h2 className="mt-3 text-3xl font-black sm:text-5xl">What should we play?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/50">Move your body, use your voice, collect stars, and have fun with Monto.</p>
          </motion.div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {GAMES.map((game, index) => (
              <motion.button key={game.route} onClick={() => router.push(game.route)} className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.07] p-5 text-left" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 + index * .12 }} whileHover={{ y: -6 }} whileTap={{ scale: .97 }} style={{ boxShadow: `0 26px 60px ${game.glow}` }}>
                <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${game.gradient}`} />
                <div className="flex items-start justify-between">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${game.gradient} text-4xl shadow-lg`}>{game.emoji}</div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition group-hover:bg-white/20"><ChevronRight /></div>
                </div>
                <game.icon className="mt-8 h-5 w-5 text-white/45" />
                <h3 className="mt-3 text-2xl font-black">{game.title}</h3>
                <p className="mt-1 text-sm text-white/50">{game.subtitle}</p>
                <div className="mt-5 flex flex-wrap gap-2">{game.skills.map(skill => <span key={skill} className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/55">{skill}</span>)}</div>
                <div className={`mt-6 flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r ${game.gradient} font-black`}>Play now</div>
              </motion.button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
