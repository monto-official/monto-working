"use client";

import { motion } from "framer-motion";
import { ArrowLeft, HeartHandshake, Snowflake, Volume2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Monto3DAvatar } from "@/components/Monto3DAvatar";

const GAMES = [
  {
    title: "Moral Adventure",
    subtitle: "Make kind choices and see what happens!",
    route: "/moral-game",
    icon: HeartHandshake,
    emoji: "💛",
    gradient: "from-amber-300 via-orange-400 to-rose-500",
    glow: "rgba(251,146,60,.3)",
    skills: ["Kindness", "Courage", "Good choices"],
  },
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
        <header className="flex items-center gap-2">
          <button onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Back"><ArrowLeft /></button>
          <button onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Close"><X /></button>
        </header>

        <section className="pt-4 pb-10 text-center sm:pb-14">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", bounce: .4 }} className="mx-auto -mb-2 h-40 w-40 sm:h-48 sm:w-48">
            <Monto3DAvatar emotion="excited" size={192} />
          </motion.div>
          <h2 className="text-3xl font-black sm:text-5xl">What should we play?</h2>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {GAMES.map((game, index) => (
              <motion.button
                key={game.route}
                onClick={() => router.push(game.route)}
                aria-label={`${game.title} — ${game.subtitle}`}
                className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.07] p-5 text-left"
                initial={{ opacity: 0, y: 40, scale: .9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: .15 + index * .12, type: "spring", bounce: .45, duration: .7 }}
                whileHover={{ y: -8, rotate: index % 2 ? .6 : -.6, transition: { type: "spring", bounce: .6 } }}
                whileTap={{ scale: .94, rotate: 0 }}
                style={{ boxShadow: `0 26px 60px ${game.glow}` }}
              >
                <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${game.gradient}`} />
                <motion.span
                  className="block text-6xl"
                  animate={{ y: [0, -8, 0], rotate: [-6, 6, -6], scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.2, delay: index * .3, repeat: Infinity, ease: "easeInOut" }}
                >
                  {game.emoji}
                </motion.span>
                <h3 className="mt-4 text-2xl font-black">{game.title}</h3>
                <div className="mt-5 flex items-center justify-between">
                  <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-xs font-bold text-white/60">{game.skills[0]}</span>
                  <motion.span
                    className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${game.gradient} text-slate-950 shadow-lg`}
                    whileHover={{ scale: 1.15, rotate: 12 }}
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ scale: { duration: 1.8, repeat: Infinity, delay: index * .25 } }}
                  >
                    <game.icon className="h-5 w-5" />
                  </motion.span>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
