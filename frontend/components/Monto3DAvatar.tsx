"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Emotion } from "@/types";

const COMIC_WORDS: Record<string, string[]> = {
  excited: ["WOW!", "YAY!", "AWESOME!", "ZOOM!"],
  surprised: ["WHOA!", "POW!", "ZAP!"],
};

const MODEL_FRAMES = ["/monto-3d.webp", "/monto-talk-open.webp", "/monto-talk-o.webp"];
const SPEECH_SEQUENCE = [1, 2, 1, 0, 1, 2, 1, 1, 0];

export type ExerciseMotionId = "march" | "shoulder" | "reach" | "bend" | "jump" | "knee" | "touch" | "balance" | "breathe";

/** Whole-body transform recipes so Monto himself can lead each PT move —
 * he's one flat sprite (no bendable limbs), so the motion has to sell the
 * exercise through bounce/tilt/squash-stretch on the whole avatar instead
 * of individual joints. Kept in the same spirit as ExerciseFigureArt's
 * per-exercise recipes so the two feel like the same character set. */
const EXERCISE_MOTION: Record<ExerciseMotionId, {
  duration: number;
  y?: number[]; rotate?: number[]; scaleX?: number[]; scaleY?: number[];
  ease?: string | [number, number, number, number];
  times?: number[];
}> = {
  march: {
    duration: 0.8,
    y: [0, -11, 0, -11, 0],
    rotate: [-4, 4, -4, 4, -4],
    scaleY: [1, 0.97, 1, 0.97, 1],
    ease: [0.34, 1.4, 0.64, 1],
  },
  shoulder: {
    duration: 1.8,
    y: [0, -4, 0, 4, 0],
    rotate: [-2, 0, 2, 0, -2],
    scaleY: [1, 1.025, 1, 0.985, 1],
    times: [0, 0.25, 0.5, 0.75, 1],
    ease: [0.45, 0.05, 0.55, 0.95],
  },
  reach: {
    duration: 1.7,
    y: [0, -15, 0],
    scaleY: [1, 1.08, 1],
    ease: [0.45, 0.05, 0.55, 0.95],
  },
  bend: {
    duration: 1.9,
    rotate: [-14, 14, -14],
    y: [0, 3, 0],
    ease: [0.45, 0.05, 0.55, 0.95],
  },
  jump: {
    duration: 1.0,
    times: [0, 0.22, 0.5, 0.78, 1],
    y: [0, 6, -32, 6, 0],
    scaleY: [1, 0.84, 1.16, 0.85, 1],
    scaleX: [1, 1.07, 0.93, 1.07, 1],
    ease: [0.34, 1.56, 0.64, 1],
  },
  knee: {
    duration: 0.7,
    y: [0, -9, 0, -9, 0],
    rotate: [3, -3, 3, -3, 3],
    ease: [0.34, 1.4, 0.64, 1],
  },
  touch: {
    duration: 2.0,
    rotate: [0, 16, 0],
    y: [0, 10, 0],
    ease: [0.45, 0.05, 0.55, 0.95],
  },
  balance: {
    duration: 3.2,
    rotate: [-2, 2, -2],
    y: [0, -2, 0],
    ease: [0.45, 0.05, 0.55, 0.95],
  },
  breathe: {
    duration: 4.5,
    times: [0, 0.35, 0.55, 0.85, 1],
    scaleY: [1, 1.07, 1.07, 1, 1],
    scaleX: [1, 0.98, 0.98, 1, 1],
    ease: [0.45, 0.05, 0.55, 0.95],
  },
};

const SPARKLE_POSITIONS = [
  { top: "6%", left: "10%" },
  { top: "2%", left: "80%" },
  { top: "20%", left: "90%" },
  { top: "32%", left: "2%" },
  { top: "58%", left: "94%" },
  { top: "64%", left: "0%" },
  { top: "10%", left: "46%" },
  { top: "76%", left: "84%" },
];

function MagicSparkles() {
  return (
    <>
      {SPARKLE_POSITIONS.map((pos, i) => (
        <motion.span
          key={i}
          className="absolute z-20 select-none pointer-events-none text-base"
          style={{ top: pos.top, left: pos.left }}
          initial={{ opacity: 0, scale: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.6], y: [0, -16, -24], rotate: [0, 180] }}
          transition={{ duration: 1.5 + (i % 3) * 0.3, repeat: Infinity, delay: i * 0.22, ease: "easeOut" }}
        >
          ✨
        </motion.span>
      ))}
    </>
  );
}

export function Monto3DAvatar({ emotion, size = 320, exercise, paused = false }: { emotion: Emotion; size?: number; exercise?: ExerciseMotionId; paused?: boolean }) {
  const move = exercise ? EXERCISE_MOTION[exercise] : undefined;
  const moveDuration = paused ? 999 : move?.duration;
  const moveTimes = paused ? undefined : move?.times;
  const talking = emotion === "talking";
  const excited = emotion === "excited" || emotion === "happy";
  const sad = emotion === "sad";
  const thinking = emotion === "thinking";
  const magic = excited || emotion === "surprised" || talking;
  const [frame, setFrame] = useState(0);
  const [lowPower, setLowPower] = useState(false);
  const [burst, setBurst] = useState<{ word: string; key: number } | null>(null);
  const prevEmotionRef = useRef<Emotion | null>(null);
  const burstIdRef = useRef(0);

  useEffect(() => {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    setLowPower(/Raspberry Pi|armv|aarch64/i.test(navigator.userAgent) || (memory !== undefined && memory <= 4));
  }, []);

  useEffect(() => {
    const words = COMIC_WORDS[emotion];
    if (words && prevEmotionRef.current !== emotion && !lowPower) {
      const word = words[Math.floor(Math.random() * words.length)];
      burstIdRef.current += 1;
      setBurst({ word, key: burstIdRef.current });
      const t = setTimeout(() => setBurst(null), 1100);
      prevEmotionRef.current = emotion;
      return () => clearTimeout(t);
    }
    prevEmotionRef.current = emotion;
  }, [emotion, lowPower]);

  useEffect(() => {
    if (!talking) { setFrame(0); return; }
    let index = 0;
    const timer = setInterval(() => {
      setFrame(SPEECH_SEQUENCE[index % SPEECH_SEQUENCE.length]);
      index += 1;
    }, lowPower ? 210 : 145);
    return () => clearInterval(timer);
  }, [talking, lowPower]);

  return (
    <motion.div
      className="monto-3d-avatar relative flex items-end justify-center"
      style={{
        width: `min(${size}px, 100%)`,
        aspectRatio: "1 / 1.08",
      }}
      animate={move ? {
        y: paused ? 0 : move.y,
        rotate: paused ? 0 : move.rotate,
        scaleX: paused ? 1 : move.scaleX,
        scaleY: paused ? 1 : move.scaleY,
      } : {
        y: lowPower
          ? talking ? [0, -2, 0] : [0, -3, 0]
          : talking ? [0, -4, 0] : sad ? [3, 7, 3] : [0, -5, 0],
        rotate: lowPower
          ? talking ? [0, 0.35, 0] : [0, 0.25, 0]
          : thinking ? [0, -2.5, 0] : excited ? [0, 1.5, -1.5, 0] : [0, 0.7, 0],
        scale: talking ? [1, lowPower ? 1.006 : 1.012, 1] : 1,
      }}
      transition={move
        ? { duration: moveDuration, repeat: Infinity, ease: move.ease ?? "easeInOut", times: moveTimes }
        : { duration: talking ? (lowPower ? 1.35 : 1.15) : (lowPower ? 4.6 : 3.8), repeat: Infinity, ease: "easeInOut" }}
      aria-label={move ? `Monto is doing ${exercise}` : `Monto is ${emotion}`}
    >
      {!lowPower && (
        <motion.div className="absolute inset-[9%] rounded-full bg-cyan-400/20 blur-3xl"
          animate={{ opacity: talking ? [0.25, 0.52, 0.25] : [0.18, 0.32, 0.18], scale: talking ? [0.94, 1.05, 0.94] : 1 }}
          transition={{ duration: talking ? 1.1 : 3, repeat: Infinity }} />
      )}

      <div className={`monto-hero-ring${talking || excited ? " is-active" : ""}`} aria-hidden="true" />

      {!lowPower && magic && <MagicSparkles />}

      <AnimatePresence>
        {burst && (
          <motion.span
            key={burst.key}
            className="monto-comic-burst absolute -top-2 right-[6%] z-30 select-none pointer-events-none text-2xl sm:text-3xl"
            style={{ "--comic-rot": "-9deg" } as React.CSSProperties}
          >
            {burst.word}
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="popLayout">
        <motion.div key={MODEL_FRAMES[frame]} className="absolute inset-0 z-10 flex items-end justify-center"
          initial={{ opacity: 0.72 }} animate={{ opacity: 1 }} exit={{ opacity: 0.65 }}
          transition={{ duration: 0.045 }}>
          <Image src={MODEL_FRAMES[frame]} alt="Monto, your friendly 3D companion"
            width={768} height={768} priority={frame === 0} draggable={false}
            className="h-full w-full object-contain drop-shadow-[0_24px_26px_rgba(0,0,0,0.38)]" />
        </motion.div>
      </AnimatePresence>

      {lowPower ? (
        <div className="absolute bottom-[2%] left-[20%] right-[20%] h-[7%] rounded-[50%] bg-black/35" />
      ) : (
        <motion.div className="absolute bottom-[2%] left-[20%] right-[20%] h-[7%] rounded-[50%] bg-black/40 blur-lg"
          animate={{ scaleX: talking ? [1, 0.88, 1] : [1, 0.92, 1], opacity: [0.34, 0.22, 0.34] }}
          transition={{ duration: talking ? 1.15 : 3.8, repeat: Infinity }} />
      )}
    </motion.div>
  );
}
