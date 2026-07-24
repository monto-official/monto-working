"use client";
import { useState } from "react";
import { motion } from "framer-motion";

interface Props { animal: string; step: number }

// `image` is the real adult-animal photo — drop a file at that path and it
// replaces the emoji automatically; until then the emoji is the fallback
// (see <img onError> below), so nothing ever looks broken.
const LIFE_CYCLES: Record<string, { image: string; stages: { emoji: string; label: string }[]; color: string }> = {
  butterfly: { image: "/explore/animals/butterfly.jpg", color: "#F472B6", stages: [{ emoji: "🥚", label: "Egg" }, { emoji: "🐛", label: "Caterpillar" }, { emoji: "🫛", label: "Cocoon" }, { emoji: "🦋", label: "Butterfly!" }] },
  frog:      { image: "/explore/animals/frog.jpg", color: "#4ade80", stages: [{ emoji: "🥚", label: "Egg" }, { emoji: "🐟", label: "Tadpole" }, { emoji: "🐸", label: "Young Frog" }, { emoji: "🐸", label: "Frog!" }] },
  chicken:   { image: "/explore/animals/chicken.jpg", color: "#FFD700", stages: [{ emoji: "🥚", label: "Egg" }, { emoji: "🐣", label: "Hatching" }, { emoji: "🐥", label: "Chick" }, { emoji: "🐔", label: "Chicken!" }] },
  dog:       { image: "/explore/animals/dog.jpg", color: "#F59E0B", stages: [{ emoji: "🐕", label: "Mother Dog" }, { emoji: "🤰", label: "Pregnant" }, { emoji: "🐶", label: "Newborn Puppy" }, { emoji: "🐕", label: "Grown Pup!" }] },
  cat:       { image: "/explore/animals/cat.jpg", color: "#A78BFA", stages: [{ emoji: "🐈", label: "Mother Cat" }, { emoji: "🤰", label: "Pregnant" }, { emoji: "🐱", label: "Kitten" }, { emoji: "🐈", label: "Cat!" }] },
};

const DEFAULT = { image: "", color: "#60A5FA", stages: [{ emoji: "🥚", label: "Born" }, { emoji: "🐾", label: "Baby" }, { emoji: "🌱", label: "Growing" }, { emoji: "✨", label: "Adult!" }] };

export function AnimalLife({ animal, step }: Props) {
  const [imgBroken, setImgBroken] = useState(false);
  const key = Object.keys(LIFE_CYCLES).find(k => animal.toLowerCase().includes(k)) ?? "";
  const cycle = LIFE_CYCLES[key] ?? DEFAULT;
  const showPhoto = cycle.image && !imgBroken;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-6 gap-5">
      <h3 className="text-white font-bold text-lg capitalize">Life Cycle of {key || animal} 🌿</h3>

      {/* Real photo of the grown animal — falls back to the last stage's emoji if missing */}
      <motion.div
        className="relative w-28 h-28 rounded-3xl overflow-hidden flex items-center justify-center text-6xl"
        style={{ border: `2px solid ${cycle.color}90`, boxShadow: `0 0 24px ${cycle.color}50`, background: `${cycle.color}15` }}
        animate={{ y: [0, -5, 0] }} transition={{ duration: 2, repeat: Infinity }}
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cycle.image} alt={key || animal} className="w-full h-full object-cover" onError={() => setImgBroken(true)} />
        ) : (
          cycle.stages[cycle.stages.length - 1].emoji
        )}
      </motion.div>

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
