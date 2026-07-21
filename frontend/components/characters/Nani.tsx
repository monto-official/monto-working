"use client";
/**
 * Nani — Adorable Nepali girl in Gunyu Cholo
 * Pixar-style SVG with premium ArmHand rigging
 */
import { motion } from "framer-motion";
import { ArmHand, ArmPose } from "@/components/characters/ArmHand";

export type NaniExpression =
  | "happy" | "excited" | "curious" | "thinking"
  | "surprised" | "explaining" | "waving" | "clapping" | "pointing";

interface Props {
  expression?: NaniExpression;
  size?: number;
  animate?: boolean;
}

function getArmPoses(expr: NaniExpression): { left: ArmPose; right: ArmPose } {
  switch (expr) {
    case "waving":     return { left: "idle",      right: "wave" };
    case "clapping":   return { left: "clap",      right: "clap" };
    case "explaining": return { left: "explain",   right: "explain" };
    case "pointing":   return { left: "idle",      right: "pointRight" };
    case "excited":    return { left: "celebrate", right: "celebrate" };
    case "thinking":   return { left: "thinking",  right: "idle" };
    case "curious":    return { left: "idle",       right: "pointUp" };
    default:           return { left: "idle",       right: "idle" };
  }
}

export function Nani({ expression = "happy", size = 200, animate = true }: Props) {
  const arms          = getArmPoses(expression);
  const isSurprised   = expression === "surprised";
  const isThinking    = expression === "thinking" || expression === "curious";
  const isExcited     = expression === "excited" || expression === "clapping";
  const eyeScaleY     = isSurprised ? 1.3 : isThinking ? 0.7 : 1;
  const scale         = size / 200;

  const mouthPath = isExcited
    ? "M 82 118 Q 100 132 118 118"
    : isSurprised
    ? "M 90 118 Q 100 126 110 118"
    : isThinking
    ? "M 86 118 Q 100 116 114 118"
    : "M 82 116 Q 100 128 118 116";

  return (
    <motion.div
      style={{ width: size, height: size * 1.4 }}
      animate={animate ? { y: [0, -6, 0] } : {}}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg width={size} height={size * 1.4} viewBox="0 0 200 280" fill="none">
        <defs>
          <radialGradient id="nani-skin" cx="40%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFD4A3"/>
            <stop offset="60%" stopColor="#F4B87A"/>
            <stop offset="100%" stopColor="#E09B5A"/>
          </radialGradient>
          <linearGradient id="nani-dress" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8403A"/><stop offset="100%" stopColor="#C0272D"/>
          </linearGradient>
          <linearGradient id="nani-cholo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#F0F0F0"/>
          </linearGradient>
          <linearGradient id="nani-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2D1A0E"/><stop offset="100%" stopColor="#1A0A04"/>
          </linearGradient>
          <radialGradient id="nani-eye" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#6B3FA0"/><stop offset="100%" stopColor="#3B1F6A"/>
          </radialGradient>
          <linearGradient id="nani-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFD700"/><stop offset="100%" stopColor="#FFA500"/>
          </linearGradient>
          <filter id="nani-shadow"><feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.2"/></filter>
          <filter id="nani-glow">
            <feGaussianBlur stdDeviation="2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Shadow */}
        <ellipse cx="100" cy="275" rx="45" ry="6" fill="#00000020"/>

        {/* Legs */}
        <rect x="82" y="220" width="16" height="44" rx="8" fill="#FFD4A3"/>
        <rect x="102" y="220" width="16" height="44" rx="8" fill="#FFD4A3"/>
        <ellipse cx="90" cy="263" rx="11" ry="7" fill="#C0272D"/>
        <ellipse cx="110" cy="263" rx="11" ry="7" fill="#C0272D"/>

        {/* Dress */}
        <motion.path
          d="M 60 170 Q 50 200 55 230 Q 80 240 100 240 Q 120 240 145 230 Q 150 200 140 170 Z"
          fill="url(#nani-dress)"
          animate={animate ? { d: [
            "M 60 170 Q 50 200 55 230 Q 80 240 100 240 Q 120 240 145 230 Q 150 200 140 170 Z",
            "M 62 170 Q 48 202 54 231 Q 80 241 100 241 Q 120 241 146 231 Q 152 202 138 170 Z",
            "M 60 170 Q 50 200 55 230 Q 80 240 100 240 Q 120 240 145 230 Q 150 200 140 170 Z",
          ]} : {}}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <path d="M 55 228 Q 100 240 145 228" stroke="#FFD700" strokeWidth="2.5" fill="none" strokeDasharray="4,3" opacity="0.9"/>
        <path d="M 58 218 Q 100 228 142 218" stroke="#FFD700" strokeWidth="1.5" fill="none" opacity="0.6"/>

        {/* Cholo */}
        <path d="M 72 130 Q 65 150 62 170 L 138 170 Q 135 150 128 130 Q 114 124 100 124 Q 86 124 72 130 Z"
          fill="url(#nani-cholo)" stroke="#E8E8E8" strokeWidth="1"/>
        <path d="M 72 130 Q 100 126 128 130" stroke="#FFD700" strokeWidth="2" fill="none"/>
        <circle cx="100" cy="142" r="2.5" fill="#FFD700"/>
        <circle cx="100" cy="154" r="2.5" fill="#FFD700"/>
        <circle cx="100" cy="166" r="2.5" fill="#FFD700"/>

        {/* Blue waist band */}
        <rect x="62" y="166" width="76" height="8" rx="3" fill="#2563EB" opacity="0.85"/>

        {/* ── NEW: Premium Arms with ArmHand ── */}
        <ArmHand
          side="left"
          pose={arms.left}
          skinColor="#F4B87A"
          sleeveColor="#FFFFFF"
          size={scale}
          animate={animate}
        />
        <ArmHand
          side="right"
          pose={arms.right}
          skinColor="#F4B87A"
          sleeveColor="#FFFFFF"
          size={scale}
          animate={animate}
        />

        {/* Gold Necklace */}
        <path d="M 82 128 Q 100 136 118 128" stroke="url(#nani-gold)" strokeWidth="3" fill="none" strokeLinecap="round"/>
        <circle cx="100" cy="136" r="4" fill="url(#nani-gold)"/>

        {/* Neck */}
        <rect x="92" y="118" width="16" height="14" rx="6" fill="#F4B87A"/>

        {/* HEAD */}
        <motion.g
          animate={animate ? { rotate: expression === "explaining" ? [-3,3,-3] : [0,2,0] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ transformOrigin: "100px 80px" }}
        >
          <ellipse cx="100" cy="78" rx="44" ry="46" fill="url(#nani-skin)" filter="url(#nani-shadow)"/>
          <ellipse cx="70" cy="90" rx="12" ry="8" fill="#FF9999" opacity="0.4"/>
          <ellipse cx="130" cy="90" rx="12" ry="8" fill="#FF9999" opacity="0.4"/>

          {/* Hair */}
          <ellipse cx="100" cy="60" rx="46" ry="34" fill="url(#nani-hair)"/>
          {/* Left ponytail */}
          <motion.g animate={animate ? { rotate:[-5,5,-5] } : {}} transition={{ duration:2.2, repeat:Infinity }}
            style={{ transformOrigin:"64px 52px" }}>
            <path d="M 64 52 Q 42 46 36 60 Q 32 72 40 82 Q 50 78 58 68 Q 56 58 64 52 Z" fill="url(#nani-hair)"/>
            <circle cx="58" cy="54" r="6" fill="#E8403A"/>
            <circle cx="58" cy="54" r="3" fill="#FF6B6B"/>
          </motion.g>
          {/* Right ponytail */}
          <motion.g animate={animate ? { rotate:[5,-5,5] } : {}} transition={{ duration:2.2, repeat:Infinity, delay:0.5 }}
            style={{ transformOrigin:"136px 52px" }}>
            <path d="M 136 52 Q 158 46 164 60 Q 168 72 160 82 Q 150 78 142 68 Q 144 58 136 52 Z" fill="url(#nani-hair)"/>
            <circle cx="142" cy="54" r="6" fill="#E8403A"/>
            <circle cx="142" cy="54" r="3" fill="#FF6B6B"/>
          </motion.g>

          {/* Earrings */}
          <circle cx="57" cy="84" r="5" fill="url(#nani-gold)" stroke="#FFD700" strokeWidth="1"/>
          <circle cx="143" cy="84" r="5" fill="url(#nani-gold)" stroke="#FFD700" strokeWidth="1"/>

          {/* Eyes */}
          <motion.ellipse cx="80" cy="78" rx="13" ry={14*eyeScaleY} fill="white" filter="url(#nani-glow)"/>
          <motion.ellipse cx="80" cy="80" rx="9" ry={10*eyeScaleY} fill="url(#nani-eye)"
            animate={animate ? { scaleY:[1,0.08,1] } : {}}
            transition={{ duration:0.12, repeat:Infinity, repeatDelay:4, ease:"easeInOut" }}/>
          <ellipse cx="81" cy="81" rx="5" ry="5.5" fill="#1A0A04"/>
          <ellipse cx="77" cy="77" rx="3" ry="2.5" fill="white" opacity="0.9"/>
          <path d="M 68 72 Q 72 68 78 70" stroke="#2D1A0E" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d="M 72 69 L 74 65" stroke="#2D1A0E" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M 78 68 L 78 64" stroke="#2D1A0E" strokeWidth="1.5" strokeLinecap="round"/>

          <motion.ellipse cx="120" cy="78" rx="13" ry={14*eyeScaleY} fill="white" filter="url(#nani-glow)"/>
          <motion.ellipse cx="120" cy="80" rx="9" ry={10*eyeScaleY} fill="url(#nani-eye)"
            animate={animate ? { scaleY:[1,0.08,1] } : {}}
            transition={{ duration:0.12, repeat:Infinity, repeatDelay:4, ease:"easeInOut", delay:0.05 }}/>
          <ellipse cx="121" cy="81" rx="5" ry="5.5" fill="#1A0A04"/>
          <ellipse cx="117" cy="77" rx="3" ry="2.5" fill="white" opacity="0.9"/>
          <path d="M 122 69 Q 128 68 132 72" stroke="#2D1A0E" strokeWidth="2" fill="none" strokeLinecap="round"/>

          {/* Eyebrows */}
          <path d="M 68 65 Q 78 61 88 64" stroke="#2D1A0E" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <path d="M 112 64 Q 122 61 132 65" stroke="#2D1A0E" strokeWidth="3" fill="none" strokeLinecap="round"/>

          {/* Nose */}
          <path d="M 96 92 Q 100 98 104 92" stroke="#D4956A" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
          <ellipse cx="97" cy="95" rx="3" ry="2" fill="#D4956A" opacity="0.4"/>
          <ellipse cx="103" cy="95" rx="3" ry="2" fill="#D4956A" opacity="0.4"/>

          {/* Mouth */}
          <motion.path d={mouthPath} stroke="#C0272D" strokeWidth="3" fill="none" strokeLinecap="round"/>
          {(expression === "happy" || isExcited) && (
            <path d="M 86 118 Q 100 126 114 118 L 112 122 Q 100 128 88 122 Z" fill="white" opacity="0.9"/>
          )}
          <circle cx="83" cy="117" r="2" fill="#D4956A" opacity="0.5"/>
          <circle cx="117" cy="117" r="2" fill="#D4956A" opacity="0.5"/>
        </motion.g>

        {/* Excited sparkles */}
        {isExcited && [{x:30,y:40,d:0},{x:170,y:35,d:0.3},{x:20,y:100,d:0.6},{x:175,y:95,d:0.2}].map((s,i) => (
          <motion.text key={i} x={s.x} y={s.y} fontSize="14"
            animate={{ opacity:[0,1,0], scale:[0.5,1.3,0.5], y:[s.y,s.y-12] }}
            transition={{ duration:1, repeat:Infinity, delay:s.d }}>✨</motion.text>
        ))}
      </svg>
    </motion.div>
  );
}
