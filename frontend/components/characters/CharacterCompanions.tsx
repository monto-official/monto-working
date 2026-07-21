"use client";
/**
 * CharacterCompanions — Shows Nani & Babu as educational guides
 * They appear during Explore Mode beside the animation panel
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Nani, NaniExpression } from "@/components/characters/Nani";
import { Babu, BabuExpression } from "@/components/characters/Babu";
import type { ExploreScene } from "@/components/ExplorePanel";

interface Props {
  scene:      ExploreScene;
  step:       number;
  isSpeaking: boolean;
  visible:    boolean;
}

// Per-scene, per-step expression and speaker mappings
const SCENE_EXPRESSIONS: Record<string, (step: number, isSpeaking: boolean) => {
  nani: NaniExpression;
  babu: BabuExpression;
  speaker: "nani" | "babu" | "both";
}> = {
  "solar-system": (step, speaking) => {
    if (step === 0) return { nani: speaking ? "explaining" : "waving", babu: "waving", speaker: "nani" };
    if (step % 2 === 0) return { nani: speaking ? "explaining" : "excited", babu: "curious", speaker: "nani" };
    return { nani: "happy", babu: speaking ? "explaining" : "excited", speaker: "babu" };
  },
  "photosynthesis": (step, speaking) => {
    if (step === 0) return { nani: "waving", babu: "waving", speaker: "both" };
    if (step < 3) return { nani: speaking ? "explaining" : "happy", babu: "curious", speaker: "nani" };
    if (step < 6) return { nani: "thinking", babu: speaking ? "explaining" : "excited", speaker: "babu" };
    return { nani: "clapping", babu: "clapping", speaker: "both" };
  },
  "animal-life": (step, speaking) => {
    if (step === 0) return { nani: "waving", babu: "curious", speaker: "nani" };
    if (step === 4) return { nani: "clapping", babu: "clapping", speaker: "both" };
    return { nani: speaking ? "explaining" : "happy", babu: step % 2 === 0 ? "curious" : "thinking", speaker: "nani" };
  },
  "water-cycle": (step, speaking) => {
    if (step === 0) return { nani: "excited", babu: "waving", speaker: "both" };
    if (step % 2 === 0) return { nani: "pointing", babu: speaking ? "explaining" : "curious", speaker: "babu" };
    return { nani: speaking ? "explaining" : "happy", babu: "thinking", speaker: "nani" };
  },
};

// Speech bubble for character dialogue
function SpeechBubble({ text, side }: { text: string; side: "left" | "right" }) {
  return (
    <motion.div
      className={`absolute -top-14 ${side === "left" ? "left-0" : "right-0"} z-20 max-w-[140px]`}
      initial={{ opacity: 0, scale: 0.7, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 5 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      <div className="bg-white rounded-2xl px-3 py-2 text-xs font-semibold text-gray-700 shadow-lg relative"
        style={{ border: "2px solid rgba(99,102,241,0.3)" }}>
        {text}
        {/* Bubble tail */}
        <div className={`absolute -bottom-2 ${side === "left" ? "left-4" : "right-4"} w-4 h-2 bg-white`}
          style={{ clipPath: side === "left" ? "polygon(0 0, 100% 0, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%)", border: "2px solid rgba(99,102,241,0.3)" }} />
      </div>
    </motion.div>
  );
}

const SCENE_TIPS: Record<string, string[]> = {
  "solar-system": [
    "नमस्ते! Let's explore space! 🚀", "Mercury is tiny and fast! ☿",
    "Venus is super hot! 🌡️", "Earth is our home! 🌍", "Mars is red! 🔴",
    "Jupiter is HUGE! 🪐", "Saturn has rings! 💍", "Uranus spins sideways! 🌀",
    "Neptune is far away! 🌊", "Amazing! You learned all planets! 🎉",
  ],
  "photosynthesis": [
    "Plants make food! 🌿", "The sun gives energy! ☀️", "Roots drink water! 💧",
    "Leaves breathe CO₂! 💨", "Magic happens inside! ⚡", "Glucose is made! 🍬",
    "Oxygen for us! 🌬️", "Plants are amazing! 🎉",
  ],
  "animal-life": [
    "Life cycles are amazing! 🌱", "Everything starts small! 🥚",
    "Watch it grow! 🌿", "A big change! ✨", "Fully grown! 🦋", "Beautiful! 💚",
  ],
  "water-cycle": [
    "Water travels everywhere! 🌍", "Sun heats the water! ☀️", "Water floats up! 💨",
    "Clouds are born! ☁️", "Rain falls down! 🌧️", "Rivers flow! 🏔️",
    "Back to ocean! 🌊", "Same water forever! 🔄",
  ],
};

export function CharacterCompanions({ scene, step, isSpeaking, visible }: Props) {
  const [mounted, setMounted] = useState(false);
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Show speech bubble briefly on each step change
  useEffect(() => {
    if (!scene) return;
    setShowBubble(true);
    const t = setTimeout(() => setShowBubble(false), 3500);
    return () => clearTimeout(t);
  }, [step, scene]);

  if (!mounted || !visible || !scene) return null;

  const getExpr = SCENE_EXPRESSIONS[scene] ?? SCENE_EXPRESSIONS["solar-system"];
  const { nani, babu, speaker } = getExpr(step, isSpeaking);

  const tips = SCENE_TIPS[scene] ?? [];
  const currentTip = tips[step] ?? tips[tips.length - 1] ?? "";

  return (
    <AnimatePresence>
      <motion.div
        key="companions"
        className="flex items-end justify-between w-full px-2 pb-1"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.3 }}
      >
        {/* ── Nani (left) ── */}
        <div className="relative flex flex-col items-center">
          <AnimatePresence>
            {showBubble && (speaker === "nani" || speaker === "both") && (
              <SpeechBubble text={currentTip} side="left" />
            )}
          </AnimatePresence>

          {/* Speaking indicator */}
          {isSpeaking && speaker === "nani" && (
            <motion.div className="flex gap-0.5 mb-1"
              animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.6, repeat: Infinity }}>
              {[1, 2, 3].map(i => (
                <motion.div key={i} className="w-1 rounded-full bg-pink-400"
                  animate={{ height: [3, 8, 3] }}
                  transition={{ duration: 0.4, delay: i * 0.1, repeat: Infinity }}/>
              ))}
            </motion.div>
          )}

          <Nani expression={nani} size={100} animate={true} />

          <motion.div
            className="text-xs font-bold mt-1 px-2 py-0.5 rounded-full"
            style={{ background: "rgba(232,64,58,0.15)", color: "#E8403A", border: "1px solid rgba(232,64,58,0.3)" }}
          >
            नानी
          </motion.div>
        </div>

        {/* ── Center info chip ── */}
        <div className="flex flex-col items-center gap-1 px-2">
          <motion.div
            className="text-xs text-center text-white/60 font-medium"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {scene === "solar-system"   ? "🪐 Space Explorers"
            : scene === "photosynthesis" ? "🌿 Science Time"
            : scene === "animal-life"    ? "🦋 Nature Walk"
            : "💧 Science Lab"}
          </motion.div>
          {/* Connecting sparkle */}
          <motion.div className="text-lg"
            animate={{ scale: [1, 1.3, 1], rotate: [0, 180, 360] }}
            transition={{ duration: 3, repeat: Infinity }}>✨</motion.div>
        </div>

        {/* ── Babu (right) ── */}
        <div className="relative flex flex-col items-center">
          <AnimatePresence>
            {showBubble && (speaker === "babu" || speaker === "both") && (
              <SpeechBubble text={currentTip} side="right" />
            )}
          </AnimatePresence>

          {isSpeaking && speaker === "babu" && (
            <motion.div className="flex gap-0.5 mb-1"
              animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.6, repeat: Infinity }}>
              {[1, 2, 3].map(i => (
                <motion.div key={i} className="w-1 rounded-full bg-indigo-400"
                  animate={{ height: [3, 8, 3] }}
                  transition={{ duration: 0.4, delay: i * 0.1, repeat: Infinity }}/>
              ))}
            </motion.div>
          )}

          <Babu expression={babu} size={100} animate={true} />

          <motion.div
            className="text-xs font-bold mt-1 px-2 py-0.5 rounded-full"
            style={{ background: "rgba(93,79,207,0.15)", color: "#5D4FCF", border: "1px solid rgba(93,79,207,0.3)" }}
          >
            बाबु
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
