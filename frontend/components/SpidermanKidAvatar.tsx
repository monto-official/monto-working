"use client";
import { motion } from "framer-motion";
import { Emotion } from "@/types";

interface SpidermanKidAvatarProps {
  emotion: Emotion;
  size?: number;
}

export function SpidermanKidAvatar({ emotion, size = 320 }: SpidermanKidAvatarProps) {
  const isHappy = emotion === "happy" || emotion === "excited";
  const isTalking = emotion === "talking";
  const isSad = emotion === "sad";

  const bounce = {
    y: isSad ? [0, -3, 0] : [0, -8, 0],
    rotate: isSad ? [0, 1, 0] : [0, -2, 0],
  } as const;

  const eyePath = isHappy
    ? "M 68 80 C 74 72 88 70 96 76 C 88 84 72 86 68 80 Z"
    : isSad
    ? "M 70 84 C 74 76 88 76 94 84 C 88 92 72 92 70 84 Z"
    : "M 68 78 C 74 70 88 68 96 74 C 88 82 72 84 68 78 Z";

  return (
    <motion.div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size * 1.08 }}
      animate={bounce}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg width={size} height={size * 1.08} viewBox="0 0 220 240" fill="none">
        <defs>
          <radialGradient id="kid-red" cx="45%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFCBC9" />
            <stop offset="55%" stopColor="#F43F5E" />
            <stop offset="100%" stopColor="#B91C1C" />
          </radialGradient>
          <radialGradient id="kid-blue" cx="45%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#D2E5FF" />
            <stop offset="50%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </radialGradient>
          <linearGradient id="kid-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx="110" cy="120" r="100" fill="rgba(255,255,255,0.08)" />
        <circle cx="170" cy="50" r="12" fill="rgba(255,255,255,0.18)" />
        <circle cx="30" cy="45" r="9" fill="rgba(255,255,255,0.18)" />

        <motion.g
          animate={{ scale: isTalking ? [1, 1.02, 1] : 1 }}
          transition={{ duration: 0.8, repeat: isTalking ? Infinity : 0, ease: "easeInOut" }}
        >
          <ellipse cx="110" cy="68" rx="56" ry="62" fill="url(#kid-red)" />
          <ellipse cx="110" cy="66" rx="56" ry="62" fill="url(#kid-glow)" opacity="0.35" />
          <path d="M 64 84 L 88 96 L 100 72 L 114 94 L 140 80" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />

          <path d="M 68 82 C 74 74 88 72 96 78 C 88 86 72 88 68 82 Z" fill="white" />
          <path d="M 122 82 C 128 74 142 72 150 78 C 142 86 126 88 122 82 Z" fill="white" />
          <path d="M 80 80 C 82 76 88 74 94 78" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
          <path d="M 132 80 C 134 76 140 74 146 78" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />

          <path d={eyePath} fill="#0F172A" opacity="0.95" />
          <circle cx="92" cy="78" r="4" fill="#FFFFFF" opacity="0.95" />
          <circle cx="138" cy="78" r="4" fill="#FFFFFF" opacity="0.95" />
        </motion.g>

        <motion.g
          animate={{ y: isTalking ? [0, -4, 0] : [0, 2, 0] }}
          transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M 72 86 C 62 122 60 150 82 164 C 102 178 118 180 138 164 C 162 146 160 112 148 90" fill="url(#kid-blue)" />
          <path d="M 82 164 C 96 178 114 178 130 164" fill="#F87171" opacity="0.2" />

          <path d="M 84 87 L 76 132 L 48 138" stroke="#E11D48" strokeWidth="16" strokeLinecap="round" />
          <path d="M 136 96 L 152 132 L 180 136" stroke="#E11D48" strokeWidth="16" strokeLinecap="round" />

          <circle cx="70" cy="150" r="12" fill="#DC2626" />
          <circle cx="150" cy="150" r="12" fill="#DC2626" />

          <path d="M 90 140 C 96 148 110 150 124 140" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
          <path d="M 92 122 C 100 132 120 132 128 122" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        </motion.g>

        <g>
          <circle cx="110" cy="132" r="22" fill="#FFFFFF" opacity="0.12" />
          <path d="M 110 118 L 110 148 M 96 132 L 124 132" stroke="#F8FAFC" strokeWidth="2" opacity="0.7" />
          <path d="M 100 122 L 120 142" stroke="#F8FAFC" strokeWidth="2" opacity="0.55" />
          <path d="M 120 122 L 100 142" stroke="#F8FAFC" strokeWidth="2" opacity="0.55" />
        </g>

        <g opacity="0.9">
          <path d="M 80 40 C 76 34 84 28 90 30 L 102 34" stroke="#FDE68A" strokeWidth="3" strokeLinecap="round" />
          <path d="M 150 32 C 148 26 156 24 160 30 L 168 40" stroke="#FDE68A" strokeWidth="3" strokeLinecap="round" />
          <circle cx="40" cy="180" r="8" fill="#FDE68A" />
          <circle cx="180" cy="190" r="6" fill="#FDE68A" />
        </g>
      </svg>
    </motion.div>
  );
}
