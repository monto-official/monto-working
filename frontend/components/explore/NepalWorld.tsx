"use client";
import { motion } from "framer-motion";

interface Props { step: number }

const TOPICS = [
  { emoji: "🏔️", image: "/explore/nepal/everest.jpg", name: "Geography", fact: "Home to Mount Everest — the tallest mountain on Earth!", color: "#60A5FA" },
  { emoji: "📜", image: "/explore/nepal/durbar-square.jpg", name: "History", fact: "Unified in 1768 by King Prithvi Narayan Shah — never colonized!", color: "#FBBF24" },
  { emoji: "🎎", image: "/explore/nepal/folk-dance.jpg", name: "Culture", fact: "Over 100 ethnic groups and languages living together!", color: "#F472B6" },
  { emoji: "🪔", image: "/explore/nepal/dashain-tika.jpg", name: "Tradition", fact: "Dashain and Tihar — festivals of blessings and lights!", color: "#FB923C" },
  { emoji: "🐅", image: "/explore/nepal/rhino.jpg", name: "Wildlife", fact: "Royal Bengal tigers and one-horned rhinos roam the jungles!", color: "#34D399" },
  { emoji: "🙏", image: "/explore/nepal/lumbini.jpg", name: "Heritage", fact: "Lumbini, in Nepal, is the birthplace of Lord Buddha!", color: "#A78BFA" },
];

export function NepalWorld({ step }: Props) {
  const finished = step >= TOPICS.length;
  const active = Math.min(step, TOPICS.length - 1);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-4 p-4 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #0f1f3d 0%, #1e3a5f 45%, #2d1b3d 100%)" }} />
      <div className="absolute bottom-0 left-0 right-0 text-4xl flex justify-center gap-6 opacity-40">🏔️🏔️🏔️</div>

      {/* Featured topic */}
      <motion.div key={active} className="relative z-10 flex flex-col items-center gap-1.5 text-center px-4"
        initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }}>
        <motion.div className="relative w-48 h-32 sm:w-56 sm:h-36 rounded-2xl overflow-hidden"
          style={{ boxShadow: `0 0 28px ${TOPICS[active].color}80`, border: `2px solid ${TOPICS[active].color}90` }}
          animate={finished ? { rotate: [-2, 2, -2], scale: [1, 1.04, 1] } : { y: [0, -6, 0] }}
          transition={{ duration: finished ? 0.6 : 1.6, repeat: Infinity }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TOPICS[active].image} alt={TOPICS[active].name} className="w-full h-full object-cover" />
          <div className="absolute top-1.5 left-1.5 w-8 h-8 rounded-full flex items-center justify-center text-lg"
            style={{ background: "rgba(15,15,30,0.75)", border: `1px solid ${TOPICS[active].color}` }}>
            {TOPICS[active].emoji}
          </div>
        </motion.div>
        <p className="text-white font-bold text-lg">{TOPICS[active].name}</p>
        <p className="text-xs text-white/60 max-w-xs">{TOPICS[active].fact}</p>
      </motion.div>

      {/* Topic strip */}
      <div className="relative z-10 flex items-center gap-2">
        {TOPICS.map((t, i) => (
          <motion.div key={t.name}
            className="w-9 h-9 rounded-xl overflow-hidden"
            style={{
              border: `1px solid ${step >= i ? t.color : "rgba(255,255,255,0.1)"}`,
              opacity: step >= i ? 1 : 0.3,
            }}
            animate={{ scale: active === i && !finished ? 1.15 : 1 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.image} alt={t.name} className="w-full h-full object-cover" />
          </motion.div>
        ))}
      </div>

      {finished && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div key={i} className="absolute text-xl" style={{ left: `${10 + i * 15}%`, top: "15%" }}
              animate={{ y: [-10, -50], opacity: [1, 0] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}>
              {i % 2 === 0 ? "🇳🇵" : "✨"}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
