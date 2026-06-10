"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Emotion } from "@/types";

interface AvatarProps {
  emotion: Emotion;
  size?: number;
}

export function Avatar({ emotion, size = 200 }: AvatarProps) {
  const isTalking = emotion === "talking";

  // Eye blink animation
  const blinkVariants = {
    open: { scaleY: 1 },
    closed: { scaleY: 0.08 },
  };

  // Mouth shapes per emotion
  const mouthPath = {
    happy: "M 70 115 Q 100 135 130 115",
    thinking: "M 80 118 Q 100 118 120 118",
    excited: "M 65 110 Q 100 140 135 110",
    sad: "M 70 125 Q 100 108 130 125",
    surprised: "M 88 112 Q 100 128 112 112",
    neutral: "M 78 118 Q 100 122 122 118",
    talking: "M 80 112 Q 100 130 120 112",
  };

  // Eye shapes per emotion
  const leftEyeY = emotion === "sad" ? 82 : emotion === "surprised" ? 78 : 85;
  const rightEyeY = leftEyeY;
  const eyeScale = emotion === "surprised" ? 1.3 : 1;

  // Face colors per emotion
  const faceColors: Record<Emotion, string> = {
    happy: "#FFF9C4",
    thinking: "#E8EAF6",
    excited: "#FFF3E0",
    sad: "#ECEFF1",
    surprised: "#FCE4EC",
    neutral: "#F3F4F6",
    talking: "#F0F4FF",
  };

  // Cheek colors
  const cheekColor = emotion === "happy" || emotion === "excited" ? "#FFCDD2" : "transparent";

  return (
    <motion.div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      animate={{
        y: [0, -6, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Glow ring */}
        <motion.circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke={emotion === "happy" ? "#4F46E5" : emotion === "excited" ? "#7C3AED" : "#4F46E5"}
          strokeWidth="2"
          opacity="0.3"
          animate={{ opacity: [0.2, 0.5, 0.2], r: [90, 94, 90] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Face background */}
        <motion.circle
          cx="100"
          cy="100"
          r="82"
          fill={faceColors[emotion]}
          animate={{ fill: faceColors[emotion] }}
          transition={{ duration: 0.4 }}
        />

        {/* Gradient overlay */}
        <defs>
          <radialGradient id="faceGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="82" fill="url(#faceGrad)" />

        {/* Cheeks */}
        <motion.ellipse
          cx="68"
          cy="110"
          rx="14"
          ry="8"
          fill={cheekColor}
          opacity="0.5"
          animate={{ opacity: cheekColor !== "transparent" ? 0.5 : 0 }}
          transition={{ duration: 0.3 }}
        />
        <motion.ellipse
          cx="132"
          cy="110"
          rx="14"
          ry="8"
          fill={cheekColor}
          opacity="0.5"
          animate={{ opacity: cheekColor !== "transparent" ? 0.5 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* LEFT EYE */}
        <motion.g
          animate={["open", "closed", "open", "open", "open"]}
          variants={blinkVariants}
          transition={{
            duration: 0.15,
            repeat: Infinity,
            repeatDelay: 3.5,
            ease: "easeInOut",
          }}
          style={{ transformOrigin: "72px 87px" }}
        >
          <motion.ellipse
            cx="72"
            cy={leftEyeY}
            rx={emotion === "thinking" ? 10 : 10 * eyeScale}
            ry={emotion === "thinking" ? 7 : 8 * eyeScale}
            fill="#1F2937"
            animate={{ cy: leftEyeY, ry: 8 * eyeScale }}
            transition={{ duration: 0.3 }}
          />
          {/* Eye shine */}
          <ellipse cx="75" cy={leftEyeY - 2} rx="3" ry="2" fill="white" opacity="0.8" />
        </motion.g>

        {/* RIGHT EYE */}
        <motion.g
          animate={["open", "closed", "open", "open", "open"]}
          variants={blinkVariants}
          transition={{
            duration: 0.15,
            repeat: Infinity,
            repeatDelay: 3.5,
            ease: "easeInOut",
            delay: 0.05,
          }}
          style={{ transformOrigin: "128px 87px" }}
        >
          <motion.ellipse
            cx="128"
            cy={rightEyeY}
            rx={10 * eyeScale}
            ry={8 * eyeScale}
            fill="#1F2937"
            animate={{ cy: rightEyeY, ry: 8 * eyeScale }}
            transition={{ duration: 0.3 }}
          />
          {/* Eye shine */}
          <ellipse cx="131" cy={rightEyeY - 2} rx="3" ry="2" fill="white" opacity="0.8" />
        </motion.g>

        {/* Eyebrows */}
        <motion.path
          d={
            emotion === "sad"
              ? "M 60 72 Q 72 78 84 74"
              : emotion === "thinking"
                ? "M 60 72 Q 72 68 84 72"
                : emotion === "surprised"
                  ? "M 60 68 Q 72 64 84 68"
                  : "M 60 74 Q 72 70 84 74"
          }
          stroke="#374151"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          animate={{
            d:
              emotion === "sad"
                ? "M 60 72 Q 72 78 84 74"
                : emotion === "thinking"
                  ? "M 60 72 Q 72 68 84 72"
                  : emotion === "surprised"
                    ? "M 60 68 Q 72 64 84 68"
                    : "M 60 74 Q 72 70 84 74",
          }}
          transition={{ duration: 0.3 }}
        />
        <motion.path
          d={
            emotion === "sad"
              ? "M 116 74 Q 128 78 140 72"
              : emotion === "thinking"
                ? "M 116 68 Q 128 72 140 72"
                : emotion === "surprised"
                  ? "M 116 68 Q 128 64 140 68"
                  : "M 116 74 Q 128 70 140 74"
          }
          stroke="#374151"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          animate={{
            d:
              emotion === "sad"
                ? "M 116 74 Q 128 78 140 72"
                : emotion === "thinking"
                  ? "M 116 68 Q 128 72 140 72"
                  : emotion === "surprised"
                    ? "M 116 68 Q 128 64 140 68"
                    : "M 116 74 Q 128 70 140 74",
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Thinking indicator */}
        <AnimatePresence>
          {emotion === "thinking" && (
            <>
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={145 + i * 10}
                  cy={72}
                  r={3 - i * 0.5}
                  fill="#4F46E5"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* NOSE */}
        <ellipse cx="100" cy="103" rx="4" ry="3" fill="#D1D5DB" opacity="0.6" />

        {/* MOUTH */}
        <motion.path
          d={mouthPath[emotion]}
          stroke="#374151"
          strokeWidth="3"
          strokeLinecap="round"
          fill={emotion === "surprised" ? "#374151" : "none"}
          animate={{
            d: isTalking
              ? [
                  mouthPath.talking,
                  "M 80 118 Q 100 128 120 118",
                  mouthPath.talking,
                  "M 82 115 Q 100 132 118 115",
                  mouthPath.talking,
                ]
              : mouthPath[emotion],
          }}
          transition={
            isTalking
              ? { duration: 0.4, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.35 }
          }
        />

        {/* Excited sparkles */}
        <AnimatePresence>
          {emotion === "excited" && (
            <>
              {[
                { x: 155, y: 55, delay: 0 },
                { x: 45, y: 60, delay: 0.2 },
                { x: 160, y: 130, delay: 0.4 },
              ].map((s, i) => (
                <motion.text
                  key={i}
                  x={s.x}
                  y={s.y}
                  fontSize="14"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], y: [s.y, s.y - 10, s.y] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity, delay: s.delay }}
                >
                  ✨
                </motion.text>
              ))}
            </>
          )}
        </AnimatePresence>
      </svg>
    </motion.div>
  );
}
