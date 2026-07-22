"use client";
import { motion } from "framer-motion";

interface Props { step: number }

const ORGANS = [
  { emoji: "🧠", name: "Brain", fact: "Controls everything you do!", color: "#A78BFA", top: "6%", left: "50%" },
  { emoji: "❤️", name: "Heart", fact: "Pumps blood day and night!", color: "#F87171", top: "34%", left: "42%" },
  { emoji: "🫁", name: "Lungs", fact: "Breathes in fresh air!", color: "#60A5FA", top: "34%", left: "58%" },
  { emoji: "💪", name: "Muscles & Bones", fact: "Help you run and jump!", color: "#FBBF24", top: "58%", left: "50%" },
  { emoji: "👀", name: "Five Senses", fact: "Help you explore the world!", color: "#34D399", top: "14%", left: "50%" },
];

export function HumanBody({ step }: Props) {
  const finished = step >= ORGANS.length;
  const shown = Math.min(step, ORGANS.length - 1);

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4">
      {/* Body silhouette */}
      <div className="relative w-40 h-64">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white/10 border border-white/15" />
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-24 h-36 rounded-[2rem] bg-white/10 border border-white/15" />
        <div className="absolute top-[11.5rem] left-1/2 -translate-x-1/2 flex gap-3">
          <div className="w-5 h-20 rounded-full bg-white/10 border border-white/15" />
          <div className="w-5 h-20 rounded-full bg-white/10 border border-white/15" />
        </div>

        {ORGANS.map((o, i) => {
          const reached = step >= i || finished;
          const isActive = step === i && !finished;
          return (
            <motion.div key={o.name} className="absolute flex flex-col items-center"
              style={{ top: o.top, left: o.left, transform: "translate(-50%, -50%)" }}
              animate={{ opacity: reached ? 1 : 0.12, scale: isActive ? 1.3 : reached ? 1 : 0.7 }}
              transition={{ duration: 0.4 }}>
              <motion.div className="text-3xl" style={{ filter: reached ? `drop-shadow(0 0 12px ${o.color}90)` : "none" }}
                animate={isActive ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 1, repeat: Infinity }}>
                {o.emoji}
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* Info card for current organ */}
      <div className="absolute bottom-3 left-3 right-3">
        <motion.div key={shown}
          className="px-4 py-2.5 rounded-2xl text-center"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {finished ? (
            <p className="text-sm font-semibold text-emerald-300">Your whole body works as a team! 🎉</p>
          ) : (
            <>
              <p className="text-sm font-bold text-white">{ORGANS[shown].name}</p>
              <p className="text-xs text-white/50">{ORGANS[shown].fact}</p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
