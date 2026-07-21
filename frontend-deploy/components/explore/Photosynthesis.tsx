"use client";
import { motion } from "framer-motion";

interface Props { step: number }

const STEPS = [
  { id: 0, label: "☀️ Sun shines on the leaf",      color: "#FFD700" },
  { id: 1, label: "💧 Roots absorb water",           color: "#60A5FA" },
  { id: 2, label: "💨 Leaves absorb CO₂",            color: "#A78BFA" },
  { id: 3, label: "⚡ Photosynthesis happens!",       color: "#34D399" },
  { id: 4, label: "🍬 Food (glucose) is created",    color: "#F472B6" },
  { id: 5, label: "🌬️ Oxygen is released!",          color: "#7DD3FC" },
];

export function Photosynthesis({ step }: Props) {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-3 p-4">
      {/* Sun */}
      <motion.div className="absolute top-4 right-8 text-5xl"
        animate={{ scale: step >= 0 ? [1,1.15,1] : 0.8, rotate: [0,10,-10,0] }}
        transition={{ duration: 3, repeat: Infinity }}>☀️</motion.div>

      {/* Plant illustration */}
      <div className="relative w-48 h-48">
        {/* Soil */}
        <div className="absolute bottom-0 w-full h-8 rounded-full" style={{ background: "#7c5c3a" }} />
        {/* Stem */}
        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-3 rounded-full"
          style={{ background: "#4ade80" }}
          animate={{ height: step >= 1 ? 100 : 40 }}
          transition={{ duration: 1.5, ease: "easeOut" }} />
        {/* Roots */}
        {step >= 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute bottom-0 left-1/2 -translate-x-1/2 text-2xl">🌱</motion.div>
        )}
        {/* Left leaf */}
        <motion.div className="absolute text-4xl"
          style={{ bottom: 80, left: 20 }}
          initial={{ scale: 0, rotate: -30 }}
          animate={step >= 0 ? { scale: 1, rotate: -20 } : { scale: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}>🍃</motion.div>
        {/* Right leaf */}
        <motion.div className="absolute text-4xl"
          style={{ bottom: 100, right: 20, scaleX: -1 }}
          initial={{ scale: 0 }}
          animate={step >= 0 ? { scale: 1 } : { scale: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}>🍃</motion.div>
        {/* CO2 bubbles */}
        {step >= 2 && [0,1,2].map(i => (
          <motion.div key={i} className="absolute text-sm font-bold text-purple-300"
            style={{ bottom: 90 + i * 20, right: 0 }}
            animate={{ y: [-5, -40], opacity: [1, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}>CO₂</motion.div>
        ))}
        {/* O2 bubbles */}
        {step >= 5 && [0,1,2].map(i => (
          <motion.div key={i} className="absolute text-sm font-bold text-blue-300"
            style={{ bottom: 90 + i * 20, left: 0 }}
            animate={{ y: [-5, -50], opacity: [1, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.5 }}>O₂</motion.div>
        ))}
        {/* Photosynthesis glow */}
        {step === 3 && (
          <motion.div className="absolute inset-0 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(74,222,128,0.3), transparent)" }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }} />
        )}
        {/* Glucose */}
        {step >= 4 && (
          <motion.div className="absolute top-2 left-1/2 -translate-x-1/2 text-2xl"
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200 }}>🍬</motion.div>
        )}
      </div>

      {/* Step labels */}
      <div className="w-full space-y-1.5 mt-2">
        {STEPS.map((s) => (
          <motion.div key={s.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: step >= s.id ? `${s.color}25` : "rgba(255,255,255,0.04)", borderLeft: step === s.id ? `3px solid ${s.color}` : "3px solid transparent" }}
            animate={{ opacity: step >= s.id ? 1 : 0.35, scale: step === s.id ? 1.03 : 1 }}
            transition={{ duration: 0.3 }}>
            <span style={{ color: step >= s.id ? s.color : "#888" }}>{s.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
