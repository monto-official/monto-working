"use client";
import { useState } from "react";
import { motion } from "framer-motion";

interface Props { step: number }

// `image` — real photo per creature. Drop a file at that path and it
// replaces the emoji automatically (falls back safely if missing).
const ZONES = [
  { image: "/explore/ocean/dolphins.jpg", emoji: "🐬", name: "Dolphins", depth: "Sunlit surface", color: "#38BDF8" },
  { image: "/explore/ocean/reef-fish.jpg", emoji: "🐠", name: "Reef fish", depth: "Coral reef", color: "#FB923C" },
  { image: "/explore/ocean/octopus.jpg", emoji: "🐙", name: "Octopus", depth: "Twilight zone", color: "#A78BFA" },
  { image: "/explore/ocean/shark.jpg", emoji: "🦈", name: "Shark", depth: "Open ocean", color: "#94A3B8" },
  { image: "/explore/ocean/glowing-creatures.jpg", emoji: "✨", name: "Glowing creatures", depth: "Midnight zone", color: "#818CF8" },
  { image: "/explore/ocean/blue-whale.jpg", emoji: "🐋", name: "Blue whale", depth: "The deep blue", color: "#2563EB" },
];

export function OceanLife({ step }: Props) {
  const [broken, setBroken] = useState<Record<number, boolean>>({});
  const finished = step >= ZONES.length;
  const active = Math.min(step, ZONES.length - 1);
  const zone = ZONES[active];

  return (
    <div className="relative w-full h-full flex items-stretch gap-3 p-4 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #38BDF8 0%, #1E3A8A 45%, #0F172A 100%)" }} />

      {/* Depth gauge */}
      <div className="relative z-10 w-6 rounded-full bg-white/10 overflow-hidden self-stretch my-2">
        <motion.div className="absolute bottom-0 w-full rounded-full"
          style={{ background: `linear-gradient(180deg, ${zone.color}, transparent)` }}
          animate={{ height: `${((active + 1) / ZONES.length) * 100}%` }} transition={{ duration: 0.6 }} />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-3">
        <motion.div key={active} initial={{ scale: 0.6, opacity: 0, y: -10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200 }} className="flex flex-col items-center gap-1.5">
          <motion.div
            className="relative w-28 h-28 rounded-3xl overflow-hidden flex items-center justify-center text-6xl"
            animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }}
            style={{ border: `2px solid ${zone.color}90`, boxShadow: `0 0 20px ${zone.color}70`, background: `${zone.color}15` }}>
            {!broken[active] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={zone.image} alt={zone.name} className="w-full h-full object-cover" onError={() => setBroken(prev => ({ ...prev, [active]: true }))} />
            ) : zone.emoji}
          </motion.div>
          <p className="text-white font-bold">{zone.name}</p>
          <p className="text-[11px] text-white/50 uppercase tracking-wide">{zone.depth}</p>
        </motion.div>

        {/* Accumulated creatures so far */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {ZONES.map((z, i) => (
            <motion.div key={z.name} className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-lg"
              animate={{ opacity: step >= i ? (active === i && !finished ? 1 : 0.55) : 0.15, scale: active === i && !finished ? 1.2 : 1 }}>
              {!broken[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={z.image} alt={z.name} className="w-full h-full object-cover" onError={() => setBroken(prev => ({ ...prev, [i]: true }))} />
              ) : z.emoji}
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
