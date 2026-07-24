"use client";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Character, Emotion } from "@/types";
import { Monto3DAvatar } from "@/components/Monto3DAvatar";
import { MessiAvatar } from "@/components/MessiAvatar";
import { Nani, type NaniExpression } from "@/components/characters/Nani";
import { Babu, type BabuExpression } from "@/components/characters/Babu";

interface AvatarProps {
  emotion: Emotion;
  character?: Character;
  size?: number;
}

const TEAR_SPOTS = [{ left: "35%" }, { left: "59%" }];

function CryingOverlay({ size }: { size: number }) {
  return (
    <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden" aria-hidden="true">
      {TEAR_SPOTS.map((pos, i) => (
        <motion.span
          key={i}
          className="absolute select-none"
          style={{ top: "32%", left: pos.left, fontSize: Math.max(14, size * 0.07) }}
          initial={{ opacity: 0, y: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], y: [0, size * 0.08, size * 0.24, size * 0.32], scale: [0.6, 1, 1, 0.8] }}
          transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.45, ease: "easeIn" }}
        >
          💧
        </motion.span>
      ))}
    </div>
  );
}

export function Avatar({ emotion, character = "spiderman", size = 320 }: AvatarProps) {
  const expression: NaniExpression & BabuExpression =
    emotion === "talking" ? "explaining" :
    emotion === "neutral" || emotion === "sad" ? "happy" : emotion;

  let content: ReactNode;
  if (character === "messi") content = <MessiAvatar emotion={emotion} size={size} />;
  else if (character === "nani") content = <Nani expression={expression} size={size * 0.72} animate />;
  else if (character === "babu") content = <Babu expression={expression} size={size * 0.72} animate />;
  else if (character === "nepali") content = (
    <div className="flex items-end justify-center" style={{ width: size, height: size, gap: size * 0.01 }} aria-label="Nani and Babu, Nepali friends">
      <Nani expression={expression} size={size * 0.42} animate />
      <Babu expression={expression} size={size * 0.42} animate />
    </div>
  );
  else content = <Monto3DAvatar emotion={emotion} size={size} />;

  return (
    <div className="relative inline-flex" style={{ width: size }}>
      {content}
      {emotion === "sad" && <CryingOverlay size={size} />}
    </div>
  );
}
