"use client";
/**
 * Babu — Adorable Nepali boy in Daura Suruwal + Dhaka Topi
 * Pixar-style SVG with premium ArmHand rigging
 */
import { motion } from "framer-motion";
import { ArmHand, ArmPose } from "@/components/characters/ArmHand";

export type BabuExpression =
  | "happy" | "excited" | "curious" | "thinking"
  | "surprised" | "explaining" | "waving" | "clapping" | "pointing";

interface Props {
  expression?: BabuExpression;
  size?: number;
  animate?: boolean;
}

function getArmPoses(expr: BabuExpression): { left: ArmPose; right: ArmPose } {
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

export function Babu({ expression = "happy", size = 200, animate = true }: Props) {
  const arms        = getArmPoses(expression);
  const isSurprised = expression === "surprised";
  const isThinking  = expression === "thinking" || expression === "curious";
  const isExcited   = expression === "excited" || expression === "clapping";
  const eyeScaleY   = isSurprised ? 1.35 : isThinking ? 0.65 : 1;
  const scale       = size / 200;

  const mouthPath = isExcited
    ? "M 82 118 Q 100 132 118 118"
    : isSurprised
    ? "M 90 118 Q 100 126 110 118"
    : isThinking
    ? "M 88 117 Q 100 115 112 117"
    : "M 84 116 Q 100 128 116 116";

  return (
    <motion.div
      style={{ width: size, height: size * 1.4 }}
      animate={animate ? { y: [0, -5, 0] } : {}}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
    >
      <svg width={size} height={size * 1.4} viewBox="0 0 200 280" fill="none">
        <defs>
          <radialGradient id="babu-skin" cx="40%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFD4A3"/><stop offset="60%" stopColor="#F4B87A"/><stop offset="100%" stopColor="#E09B5A"/>
          </radialGradient>
          <linearGradient id="babu-white" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FAFAFA"/><stop offset="100%" stopColor="#EBEBEB"/>
          </linearGradient>
          <linearGradient id="babu-vest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2D2D2D"/><stop offset="100%" stopColor="#111111"/>
          </linearGradient>
          <linearGradient id="babu-topi" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7B3FAB"/><stop offset="35%" stopColor="#E8403A"/>
            <stop offset="65%" stopColor="#F59E0B"/><stop offset="100%" stopColor="#10B981"/>
          </linearGradient>
          <linearGradient id="babu-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2D1A0E"/><stop offset="100%" stopColor="#1A0A04"/>
          </linearGradient>
          <radialGradient id="babu-eye" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#5B4FCF"/><stop offset="100%" stopColor="#2D1F7A"/>
          </radialGradient>
          <filter id="babu-shadow"><feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.2"/></filter>
          <filter id="babu-glow">
            <feGaussianBlur stdDeviation="2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Shadow */}
        <ellipse cx="100" cy="275" rx="42" ry="6" fill="#00000020"/>

        {/* Legs / Suruwal */}
        <rect x="80" y="216" width="17" height="50" rx="7" fill="url(#babu-white)" stroke="#E0E0E0" strokeWidth="0.5"/>
        <rect x="103" y="216" width="17" height="50" rx="7" fill="url(#babu-white)" stroke="#E0E0E0" strokeWidth="0.5"/>
        <ellipse cx="88" cy="265" rx="11" ry="7" fill="#2D1A0E"/>
        <ellipse cx="111" cy="265" rx="11" ry="7" fill="#2D1A0E"/>
        <ellipse cx="84" cy="261" rx="4" ry="2" fill="white" opacity="0.2"/>
        <ellipse cx="107" cy="261" rx="4" ry="2" fill="white" opacity="0.2"/>

        {/* Daura body */}
        <path d="M 68 130 Q 62 155 60 180 Q 62 195 68 210 L 132 210 Q 138 195 140 180 Q 138 155 132 130 Q 116 124 100 124 Q 84 124 68 130 Z"
          fill="url(#babu-white)" stroke="#E0E0E0" strokeWidth="0.5"/>
        <path d="M 82 128 Q 75 155 72 180" stroke="#D0D0D0" strokeWidth="1.5" fill="none"/>
        <path d="M 84 126 Q 100 130 116 126" stroke="#CCCCCC" strokeWidth="1.5" fill="none"/>

        {/* Black waistcoat */}
        <path d="M 74 132 Q 70 155 70 178 L 85 178 Q 84 155 86 132 Z" fill="url(#babu-vest)"/>
        <path d="M 126 132 Q 130 155 130 178 L 115 178 Q 116 155 114 132 Z" fill="url(#babu-vest)"/>
        {[142,154,166].map((y,i) => <circle key={i} cx="100" cy={y} r="3" fill="#444" stroke="#666" strokeWidth="0.5"/>)}
        <path d="M 86 132 Q 100 138 114 132 L 110 144 Q 100 148 90 144 Z" fill="url(#babu-vest)" opacity="0.8"/>

        {/* ── NEW: Premium Arms with ArmHand ── */}
        <ArmHand
          side="left"
          pose={arms.left}
          skinColor="#F4B87A"
          sleeveColor="#FAFAFA"
          size={scale}
          animate={animate}
        />
        <ArmHand
          side="right"
          pose={arms.right}
          skinColor="#F4B87A"
          sleeveColor="#FAFAFA"
          size={scale}
          animate={animate}
        />

        {/* Neck */}
        <rect x="90" y="118" width="20" height="14" rx="7" fill="#F4B87A"/>

        {/* HEAD */}
        <motion.g
          animate={animate ? { rotate: expression === "explaining" ? [-2,4,-2] : [0,1.5,0] } : {}}
          transition={{ duration: 2.4, repeat: Infinity }}
          style={{ transformOrigin: "100px 78px" }}
        >
          <ellipse cx="100" cy="78" rx="43" ry="46" fill="url(#babu-skin)" filter="url(#babu-shadow)"/>
          <ellipse cx="70" cy="92" rx="11" ry="7.5" fill="#FF9999" opacity="0.38"/>
          <ellipse cx="130" cy="92" rx="11" ry="7.5" fill="#FF9999" opacity="0.38"/>

          {/* Hair */}
          <path d="M 58 70 Q 60 55 80 48 Q 100 44 120 48 Q 140 55 142 70" fill="url(#babu-hair)"/>
          <path d="M 58 70 Q 56 82 58 90" stroke="#2D1A0E" strokeWidth="8" strokeLinecap="round" fill="none"/>
          <path d="M 142 70 Q 144 82 142 90" stroke="#2D1A0E" strokeWidth="8" strokeLinecap="round" fill="none"/>

          {/* Dhaka Topi */}
          <motion.g animate={animate ? { rotate:[0,1,0,-1,0] } : {}} transition={{ duration:3, repeat:Infinity }}
            style={{ transformOrigin:"100px 52px" }}>
            <path d="M 62 70 Q 64 50 100 44 Q 136 50 138 70 Z" fill="url(#babu-topi)"/>
            <path d="M 70 62 Q 100 56 130 62" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none"/>
            <path d="M 72 66 L 128 66" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
            {[75,85,95,105,115,125].map((x,i) => (
              <line key={i} x1={x} y1="52" x2={x-3} y2="68" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
            ))}
            <path d="M 58 70 Q 100 74 142 70" fill="#5C2A8A" opacity="0.7"/>
            <path d="M 58 70 Q 100 76 142 70" stroke="#4A1E7A" strokeWidth="2" fill="none"/>
          </motion.g>

          {/* Eyes */}
          <motion.ellipse cx="80" cy="80" rx="12.5" ry={13.5*eyeScaleY} fill="white" filter="url(#babu-glow)"/>
          <motion.ellipse cx="80" cy="82" rx="8.5" ry={9.5*eyeScaleY} fill="url(#babu-eye)"
            animate={animate ? { scaleY:[1,0.08,1] } : {}}
            transition={{ duration:0.12, repeat:Infinity, repeatDelay:3.5, ease:"easeInOut" }}/>
          <ellipse cx="81" cy="83" rx="4.8" ry="5.2" fill="#0D0722"/>
          <ellipse cx="77" cy="79" rx="2.8" ry="2.3" fill="white" opacity="0.9"/>
          <path d="M 68 74 Q 74 70 80 72" stroke="#2D1A0E" strokeWidth="2.2" fill="none" strokeLinecap="round"/>

          <motion.ellipse cx="120" cy="80" rx="12.5" ry={13.5*eyeScaleY} fill="white" filter="url(#babu-glow)"/>
          <motion.ellipse cx="120" cy="82" rx="8.5" ry={9.5*eyeScaleY} fill="url(#babu-eye)"
            animate={animate ? { scaleY:[1,0.08,1] } : {}}
            transition={{ duration:0.12, repeat:Infinity, repeatDelay:3.5, ease:"easeInOut", delay:0.06 }}/>
          <ellipse cx="121" cy="83" rx="4.8" ry="5.2" fill="#0D0722"/>
          <ellipse cx="117" cy="79" rx="2.8" ry="2.3" fill="white" opacity="0.9"/>
          <path d="M 120 72 Q 126 70 132 74" stroke="#2D1A0E" strokeWidth="2.2" fill="none" strokeLinecap="round"/>

          {/* Eyebrows */}
          <path d="M 68 66 Q 78 62 88 65" stroke="#2D1A0E" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <path d="M 112 65 Q 122 62 132 66" stroke="#2D1A0E" strokeWidth="3" fill="none" strokeLinecap="round"/>

          {/* Nose */}
          <path d="M 96 94 Q 100 100 104 94" stroke="#D4956A" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
          <ellipse cx="97" cy="97" rx="2.8" ry="2" fill="#D4956A" opacity="0.35"/>
          <ellipse cx="103" cy="97" rx="2.8" ry="2" fill="#D4956A" opacity="0.35"/>

          {/* Mouth */}
          <motion.path d={mouthPath} stroke="#C0272D" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
          {(expression === "happy" || isExcited) && (
            <path d="M 87 118 Q 100 126 113 118 L 111 122 Q 100 128 89 122 Z" fill="white" opacity="0.85"/>
          )}
          <circle cx="84" cy="117" r="2" fill="#D4956A" opacity="0.45"/>
          <circle cx="116" cy="117" r="2" fill="#D4956A" opacity="0.45"/>
        </motion.g>

        {/* Excited sparkles */}
        {isExcited && [{x:25,y:38,d:0},{x:168,y:33,d:0.3},{x:18,y:96,d:0.6},{x:172,y:92,d:0.15}].map((s,i) => (
          <motion.text key={i} x={s.x} y={s.y} fontSize="13"
            animate={{ opacity:[0,1,0], y:[s.y,s.y-14], scale:[0.5,1.3,0.5] }}
            transition={{ duration:1.1, repeat:Infinity, delay:s.d }}>⭐</motion.text>
        ))}
      </svg>
    </motion.div>
  );
}
