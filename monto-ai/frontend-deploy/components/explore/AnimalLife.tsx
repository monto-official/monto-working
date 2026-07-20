"use client";
import { motion } from "framer-motion";

interface Props { animal: string; step: number }

const LIFE_CYCLES: Record<string, { stages: { emoji: string; label: string }[]; color: string }> = {
  butterfly: { color: "#F472B6", stages: [{ emoji: "🥚", label: "Egg" }, { emoji: "🐛", label: "Caterpillar" }, { emoji: "🫛", label: "Cocoon" }, { emoji: "🦋", label: "Butterfly!" }] },
  frog:      { color: "#4ade80", stages: [{ emoji: "🥚", label: "Egg" }, { emoji: "🐟", label: "Tadpole" }, { emoji: "🐸", label: "Young Frog" }, { emoji: "🐸", label: "Frog!" }] },
  chicken:   { color: "#FFD700", stages: [{ emoji: "🥚", label: "Egg" }, { emoji: "🐣", label: "Hatching" }, { emoji: "🐥", label: "Chick" }, { emoji: "🐔", label: "Chicken!" }] },
  dog:       { color: "#F59E0B", stages: [{ emoji: "🐕", label: "Mother Dog" }, { emoji: "🤰", label: "Pregnant" }, { emoji: "🐶", label: "Newborn Puppy" }, { emoji: "🐕", label: "Grown Pup!" }] },
  cat:       { color: "#A78BFA", stages: [{ emoji: "🐈", label: "Mother Cat" }, { emoji: "🤰", label: "Pregnant" }, { emoji: "🐱", label: "Kitten" }, { emoji: "🐈", label: "Cat!" }] },
};

const DEFAULT = { color: "#60A5FA", stages: [{ emoji: "🥚", label: "Born" }, { emoji: "🐾", label: "Baby" }, { emoji: "🌱", label: "Growing" }, { emoji: "✨", label: "Adult!" }] };

export function AnimalLife({ animal, step }: Props) {
  const key = Object.keys(LIFE_CYCLES).find(k => animal.toLowerCase().includes(k)) ?? "";
  const cycle = LIFE_CYCLES[key] ?? DEFAULT;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-6 gap-6">
      <h3 className="text-white font-bold text-lg capitalize">Life Cycle of {key || animal} 🌿</h3>

      {/* Cycle stages */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {cycle.stages.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <motion.div
              className="flex flex-col items-center gap-1"
              animate={{
                scale: step === i ? [1, 1.2, 1] : step > i ? 0.9 : 0.7,
                opacity: step >= i ? 1 : 0.3,
              }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="text-5xl rounded-2xl p-3 border-2"
                style={{
                  borderColor: step === i ? cycle.color : step > i ? `${cycle.color}50` : "transparent",
                  background: step === i ? `${cycle.color}20` : "rgba(255,255,255,0.04)",
                  boxShadow: step === i ? `0 0 20px ${cycle.color}60` : "none",
                }}
                animate={step === i ? { y: [0, -8, 0] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {s.emoji}
              </motion.div>
              <span className="text-xs font-semibold" style={{ color: step >= i ? cycle.color : "#666" }}>
                {s.label}
              </span>
            </motion.div>

            {/* Arrow */}
            {i < cycle.stages.length - 1 && (
              <motion.div
                className="text-xl"
                animate={{ opacity: step > i ? 1 : 0.2, x: step > i ? [0, 4, 0] : 0 }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                →
              </motion.div>
            )}
          </div>
        ))}
      </div>

      {/* Current step description */}
      <motion.div
        key={step}
        className="px-4 py-2 rounded-xl text-sm text-center font-medium text-white"
        style={{ background: `${cycle.color}25`, border: `1px solid ${cycle.color}50` }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {step < cycle.stages.length
          ? `Stage ${step + 1}: ${cycle.stages[step].label} ${cycle.stages[step].emoji}`
          : "Life cycle complete! 🎉"}
      </motion.div>

      {/* Floating sparkles */}
      {step === cycle.stages.length - 1 && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-xl"
              style={{ left: `${10 + i * 11}%`, top: "20%" }}
              animate={{ y: [-10, -60], opacity: [1, 0], rotate: [0, 360] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            >✨</motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
