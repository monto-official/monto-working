"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Calculator, ChevronRight, Hash, PawPrint, PenTool, X } from "lucide-react";
import { useRouter } from "next/navigation";

function playRoute(src: string, title: string) {
  return `/play?src=${encodeURIComponent(src)}&title=${encodeURIComponent(title)}`;
}

const GAMES = [
  {
    title: "Math Quiz",
    subtitle: "Listen to the sum and say the answer!",
    route: "/math-quiz",
    icon: Calculator,
    emoji: "🧮",
    gradient: "from-indigo-400 via-fuchsia-500 to-rose-400",
    glow: "rgba(129,140,248,.32)",
    skills: ["Addition", "Listening", "Speaking"],
  },
  {
    title: "Counting Game",
    subtitle: "Count how many, then say the number!",
    route: playRoute("https://previews.customer.envatousercontent.com/files/348714878/index.html", "Counting Game"),
    icon: Hash,
    emoji: "🔢",
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    glow: "rgba(52,211,153,.3)",
    skills: ["Counting", "Listening", "Speaking"],
  },
  {
    title: "Learn Drawing",
    subtitle: "Trace shapes and letters with your finger!",
    route: playRoute("https://demonisblack.com/code/2022/learndrawing/game/", "Learn Drawing"),
    icon: PenTool,
    emoji: "✏️",
    gradient: "from-violet-400 via-purple-500 to-cyan-400",
    glow: "rgba(167,139,250,.3)",
    skills: ["Shapes", "Letters", "Fine motor"],
  },
  {
    title: "Animal Word",
    subtitle: "Learn animal names, then find the match!",
    route: playRoute("https://previews.customer.envatousercontent.com/files/343204522/index.html", "Animal Word"),
    icon: PawPrint,
    emoji: "🦁",
    gradient: "from-amber-300 via-orange-400 to-emerald-500",
    glow: "rgba(251,191,36,.3)",
    skills: ["Animals", "Vocabulary", "Memory"],
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

      <div className="relative z-10 mx-auto min-h-[100dvh] w-full max-w-5xl px-5 py-5 sm:px-8">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .5 }}
          className="flex items-center gap-2"
        >
          <button onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 backdrop-blur transition hover:bg-white/20" aria-label="Back"><ArrowLeft /></button>
          <button onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 backdrop-blur transition hover:bg-white/20" aria-label="Close"><X /></button>
        </motion.header>

        <section className="pt-6 pb-10 sm:pb-14">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GAMES.map((game, index) => (
              <motion.button
                key={game.route}
                onClick={() => router.push(game.route)}
                aria-label={`${game.title} — ${game.subtitle}`}
                className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.07] p-5 text-left transition-colors hover:border-white/20"
                initial={{ opacity: 0, y: 40, scale: .9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: .15 + index * .12, type: "spring", bounce: .45, duration: .7 }}
                whileHover={{ y: -8, rotate: index % 2 ? .6 : -.6, transition: { type: "spring", bounce: .6 } }}
                whileTap={{ scale: .94, rotate: 0 }}
                style={{ boxShadow: `0 26px 60px ${game.glow}` }}
              >
                <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${game.gradient}`} />
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-80"
                  style={{ background: game.glow, opacity: 0.55 }}
                />

                <motion.span
                  className="relative block text-6xl"
                  animate={{ y: [0, -8, 0], rotate: [-6, 6, -6], scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.2, delay: index * .3, repeat: Infinity, ease: "easeInOut" }}
                >
                  {game.emoji}
                </motion.span>

                <h3 className="relative mt-4 text-2xl font-black">{game.title}</h3>
                <p className="relative mt-1.5 text-sm leading-snug text-white/50">{game.subtitle}</p>

                <div className="relative mt-4 flex flex-wrap gap-1.5">
                  {game.skills.map(skill => (
                    <span key={skill} className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[11px] font-bold text-white/60">{skill}</span>
                  ))}
                </div>

                <div className="relative mt-5 flex items-center justify-between">
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    whileHover={{ opacity: 1, x: 0 }}
                    className="hidden items-center gap-0.5 text-xs font-bold text-white/60 group-hover:flex"
                  >
                    Play <ChevronRight className="h-3.5 w-3.5" />
                  </motion.span>
                  <motion.span
                    className={`ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${game.gradient} text-slate-950 shadow-lg`}
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
