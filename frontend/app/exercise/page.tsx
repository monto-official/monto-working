"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, Dumbbell, Waves, X, Zap } from "lucide-react";
import { Monto3DAvatar } from "@/components/Monto3DAvatar";

const workouts = [
  {
    title: "Move & Groove",
    detail: "8 guided moves with Monto — march, stretch, jump and balance.",
    duration: "3 min",
    route: "/yoga",
    icon: Dumbbell,
    gradient: "from-emerald-400 to-cyan-400",
    glow: "rgba(52,211,153,.28)",
    art: "🏃",
  },
  {
    title: "Freeze Dance",
    detail: "Dance fast, then freeze faster! A playful cardio party.",
    duration: "5 min",
    route: "/freeze-dance",
    icon: Zap,
    gradient: "from-fuchsia-400 to-violet-500",
    glow: "rgba(192,132,252,.3)",
    art: "🕺",
  },
  {
    title: "Calm & Stretch",
    detail: "Slow, gentle moves and quiet breathing for a happy body.",
    duration: "3 min",
    route: "/yoga",
    icon: Waves,
    gradient: "from-sky-400 to-indigo-500",
    glow: "rgba(56,189,248,.28)",
    art: "🧘",
  },
];

export default function ExercisePage() {
  const router = useRouter();

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#07131e] text-white select-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_2%,rgba(45,212,191,.24),transparent_30%),radial-gradient(circle_at_92%_24%,rgba(129,140,248,.24),transparent_34%),linear-gradient(155deg,#06111b_0%,#0b2130_52%,#11142d_100%)]" />
      {["⭐", "⚡", "💪", "🌈"].map((item, index) => (
        <motion.span
          key={item}
          className="absolute text-3xl opacity-10"
          style={{ left: `${8 + index * 27}%`, top: `${18 + (index % 2) * 55}%` }}
          animate={{ y: [0, -14, 0], rotate: [-8, 8, -8] }}
          transition={{ duration: 3 + index * .4, repeat: Infinity }}
        >
          {item}
        </motion.span>
      ))}

      <div className="relative z-10 mx-auto min-h-[100dvh] w-full max-w-5xl px-5 pb-10 pt-5 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur" aria-label="Back home">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <section className="mx-auto mt-2 max-w-2xl text-center">
          <motion.div initial={{ scale: .6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: .5 }} className="mx-auto -mb-2 h-36 w-36 sm:h-40 sm:w-40">
            <Monto3DAvatar emotion="excited" size={160} />
          </motion.div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Let&apos;s move! 🎉</h1>
          <p className="mx-auto mt-2 max-w-md text-base text-white/55">Pick one and follow Monto.</p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {workouts.map((workout, index) => (
            <motion.button
              key={workout.title}
              onClick={() => router.push(workout.route)}
              aria-label={`${workout.title} — ${workout.detail}`}
              initial={{ opacity: 0, y: 40, scale: .9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: .15 + index * .12, type: "spring", bounce: .45, duration: .7 }}
              whileHover={{ y: -8, rotate: index % 2 ? .6 : -.6, transition: { type: "spring", bounce: .6 } }}
              whileTap={{ scale: .93, rotate: 0 }}
              className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.075] p-5 text-left backdrop-blur-xl"
              style={{ boxShadow: `0 24px 65px ${workout.glow}` }}
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${workout.gradient}`} />
              <motion.span
                className="block text-6xl"
                animate={{ y: [0, -8, 0], rotate: [-6, 6, -6], scale: [1, 1.06, 1] }}
                transition={{ duration: 2.2, delay: index * .3, repeat: Infinity, ease: "easeInOut" }}
              >
                {workout.art}
              </motion.span>
              <h2 className="mt-4 text-2xl font-black">{workout.title}</h2>
              <div className="mt-5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/70">
                  <Clock3 className="h-3.5 w-3.5" />{workout.duration}
                </span>
                <motion.span
                  className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${workout.gradient} text-slate-950 shadow-lg`}
                  whileHover={{ scale: 1.15, rotate: 12 }}
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ scale: { duration: 1.8, repeat: Infinity, delay: index * .25 } }}
                >
                  <workout.icon className="h-5 w-5" />
                </motion.span>
              </div>
            </motion.button>
          ))}
        </section>
      </div>
    </main>
  );
}
