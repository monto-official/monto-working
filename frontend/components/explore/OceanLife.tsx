"use client";
import { motion } from "framer-motion";

interface Props { step: number }

const ZONES = [
  { emoji: "🐬", name: "Dolphins", depth: "Sunlit surface", color: "#38BDF8" },
  { emoji: "🐠", name: "Reef fish", depth: "Coral reef", color: "#FB923C" },
  { emoji: "🐙", name: "Octopus", depth: "Twilight zone", color: "#A78BFA" },
  { emoji: "🦈", name: "Shark", depth: "Open ocean", color: "#94A3B8" },
  { emoji: "✨", name: "Glowing creatures", depth: "Midnight zone", color: "#818CF8" },
  { emoji: "🐋", name: "Blue whale", depth: "The deep blue", color: "#2563EB" },
];

export function OceanLife({ step }: Props) {
  const finished = step >= ZONES.length;
  const active = Math.min(step, ZONES.length - 1);

  return (
    <div className="relative w-full h-full flex items-stretch gap-3 p-4 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #38BDF8 0%, #1E3A8A 45%, #0F172A 100%)" }} />

      {/* Depth gauge */}
      <div className="relative z-10 w-6 rounded-full bg-white/10 overflow-hidden self-stretch my-2">
        <motion.div className="absolute bottom-0 w-full rounded-full"
          style={{ background: `linear-gradient(180deg, ${ZONES[active].color}, transparent)` }}
          animate={{ height: `${((active + 1) / ZONES.length) * 100}%` }} transition={{ duration: 0.6 }} />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-3">
        <motion.div key={active} initial={{ scale: 0.6, opacity: 0, y: -10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }} className="flex flex-col items-center gap-1">
          <motion.div className="text-7xl" animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }}
            style={{ filter: `drop-shadow(0 0 20px ${ZONES[active].color}90)` }}>
            {ZONES[active].emoji}
          </motion.div>
          <p className="text-white font-bold">{ZONES[active].name}</p>
          <p className="text-[11px] text-white/50 uppercase tracking-wide">{ZONES[active].depth}</p>
        </motion.div>

        {/* Accumulated creatures so far */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {ZONES.map((z, i) => (
            <motion.div key={z.name} className="text-xl"
              animate={{ opacity: step >= i ? (active === i && !finished ? 1 : 0.55) : 0.15, scale: active === i && !finished ? 1.2 : 1 }}>
              {z.emoji}
            </motion.div>
          ))}
        </div>
      </div>

      {finished && Array.from({ length: 5 }).map((_, i) => (
        <motion.div key={i} className="absolute text-lg z-10" style={{ left: `${15 + i * 16}%`, top: `${20 + (i % 2) * 40}%` }}
          animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.25 }}>💙</motion.div>
      ))}
    </div>
  );
}
