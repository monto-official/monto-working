"use client";
import { motion } from "framer-motion";

interface Props { step: number }

const STEPS = [
  { label: "☀️ Sun heats water",             color: "#FFD700" },
  { label: "💨 Water evaporates (rises up)",  color: "#93C5FD" },
  { label: "☁️ Clouds form (condensation)",   color: "#E5E7EB" },
  { label: "🌧️ Rain falls (precipitation)",   color: "#60A5FA" },
  { label: "🏔️ Water collects in rivers",     color: "#34D399" },
  { label: "🌊 Returns to ocean — cycle repeats!", color: "#818CF8" },
];

export function WaterCycle({ step }: Props) {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 gap-4">
      {/* Scene */}
      <div className="relative w-full h-36 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(180deg, #1e3a5f 0%, #1e3a5f 60%, #2d5a27 60%, #2d5a27 80%, #1a3a5c 80%)" }}>
        {/* Sun */}
        <motion.div className="absolute top-2 right-6 text-3xl"
          animate={{ scale: step === 0 ? [1,1.2,1] : 1 }}
          transition={{ duration: 1.5, repeat: Infinity }}>☀️</motion.div>

        {/* Cloud */}
        <motion.div className="absolute top-3 left-1/2 -translate-x-1/2 text-4xl"
          animate={{
            opacity: step >= 2 ? 1 : 0.2,
            scale: step === 2 ? [1,1.1,1] : 1,
            x: step >= 1 ? [0, 10, 0] : 0,
          }}
          transition={{ duration: 3, repeat: Infinity }}>☁️</motion.div>

        {/* Rain drops */}
        {step >= 3 && [0,1,2,3,4].map(i => (
          <motion.div key={i} className="absolute text-sm"
            style={{ left: `${35 + i * 8}%`, top: 30 }}
            animate={{ y: [0, 60], opacity: [1, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}>💧</motion.div>
        ))}

        {/* Mountain/river */}
        <div className="absolute bottom-8 text-2xl left-4">🏔️</div>
        {step >= 4 && (
          <motion.div className="absolute bottom-8 left-14 text-xl"
            animate={{ x: [0, 40, 80] }}
            transition={{ duration: 3, repeat: Infinity }}>🌊</motion.div>
        )}

        {/* Evaporation arrows */}
        {step >= 1 && [0,1,2].map(i => (
          <motion.div key={i} className="absolute text-blue-300 text-xs font-bold"
            style={{ bottom: 50 + i * 10, left: `${25 + i * 8}%` }}
            animate={{ y: [0, -30], opacity: [1, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}>↑</motion.div>
        ))}

        {/* Ocean */}
        <motion.div className="absolute bottom-0 w-full h-8 text-center text-xs text-blue-200 flex items-center justify-center"
          style={{ background: "rgba(30,58,92,0.8)" }}>
          🌊 Ocean
        </motion.div>
      </div>

      {/* Steps */}
      <div className="w-full space-y-1.5">
        {STEPS.map((s, i) => (
          <motion.div key={i}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: step >= i ? `${s.color}20` : "rgba(255,255,255,0.03)", borderLeft: step === i ? `3px solid ${s.color}` : "3px solid transparent" }}
            animate={{ opacity: step >= i ? 1 : 0.3, scale: step === i ? 1.02 : 1 }}>
            <span style={{ color: step >= i ? s.color : "#555" }}>{s.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
