"use client";
import { motion } from "framer-motion";

interface Props { step: number }

const DINOS = [
  { emoji: "🦖", name: "T-Rex", fact: "Giant hunter with tiny arms!", color: "#F87171" },
  { emoji: "🦕", name: "Triceratops", fact: "Three horns for defense!", color: "#34D399" },
  { emoji: "🦴", name: "Stegosaurus", fact: "Bony plates along its back!", color: "#FBBF24" },
  { emoji: "🌳", name: "Brachiosaurus", fact: "A super long neck!", color: "#60A5FA" },
  { emoji: "🦅", name: "Pterodactyl", fact: "Flew through the sky!", color: "#A78BFA" },
  { emoji: "🏃", name: "Velociraptor", fact: "Small, fast, hunted in packs!", color: "#FB923C" },
];

export function DinosaurWorld({ step }: Props) {
  const finished = step >= DINOS.length;
  const active = Math.min(step, DINOS.length - 1);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-4 p-4 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #4a3728 0%, #6b4d35 38%, #3d5c3a 38%, #2d4a2a 100%)" }} />
      <div className="absolute bottom-6 left-6 text-3xl opacity-70">🌋</div>
      <div className="absolute bottom-4 right-10 text-2xl opacity-60">🌿</div>
      <div className="absolute bottom-4 left-1/3 text-2xl opacity-60">🌿</div>

      {/* Featured dino */}
      <motion.div key={active} className="relative z-10 flex flex-col items-center gap-1"
        initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }}>
        <motion.div className="text-8xl" style={{ filter: `drop-shadow(0 0 24px ${DINOS[active].color}80)` }}
          animate={finished ? { rotate: [-4, 4, -4], scale: [1, 1.08, 1] } : { y: [0, -10, 0] }}
          transition={{ duration: finished ? 0.6 : 1.4, repeat: Infinity }}>
          {DINOS[active].emoji}
        </motion.div>
        <p className="text-white font-bold text-lg">{DINOS[active].name}</p>
        <p className="text-xs text-white/60">{DINOS[active].fact}</p>
      </motion.div>

      {/* Parade strip */}
      <div className="relative z-10 flex items-center gap-2">
        {DINOS.map((d, i) => (
          <motion.div key={d.name}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{
              background: step >= i ? `${d.color}30` : "rgba(255,255,255,0.05)",
              border: `1px solid ${step >= i ? d.color : "rgba(255,255,255,0.1)"}`,
              opacity: step >= i ? 1 : 0.35,
            }}
            animate={{ scale: active === i && !finished ? 1.15 : 1 }}>
            {d.emoji}
          </motion.div>
        ))}
      </div>

      {finished && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div key={i} className="absolute text-xl" style={{ left: `${10 + i * 15}%`, top: "15%" }}
              animate={{ y: [-10, -50], opacity: [1, 0] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}>💥</motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
