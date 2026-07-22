"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Emotion } from "@/types";

const MODEL_FRAMES = ["/monto-3d.webp", "/monto-talk-open.webp", "/monto-talk-o.webp"];
const SPEECH_SEQUENCE = [1, 2, 1, 0, 1, 2, 1, 1, 0];

export function Monto3DAvatar({ emotion, size = 320 }: { emotion: Emotion; size?: number }) {
  const talking = emotion === "talking";
  const excited = emotion === "excited" || emotion === "happy";
  const sad = emotion === "sad";
  const thinking = emotion === "thinking";
  const [frame, setFrame] = useState(0);
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    setLowPower(/Raspberry Pi|armv|aarch64/i.test(navigator.userAgent) || (memory !== undefined && memory <= 4));
  }, []);

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
      style={{ width: size, height: size * 1.08 }}
      animate={{
        y: lowPower ? 0 : talking ? [0, -4, 0] : sad ? [3, 7, 3] : [0, -5, 0],
        rotate: lowPower ? 0 : thinking ? [0, -2.5, 0] : excited ? [0, 1.5, -1.5, 0] : [0, 0.7, 0],
        scale: lowPower ? 1 : talking ? [1, 1.012, 1] : 1,
      }}
      transition={{ duration: talking ? 1.15 : 3.8, repeat: Infinity, ease: "easeInOut" }}
      aria-label={`Monto is ${emotion}`}
    >
      {!lowPower && (
        <motion.div className="absolute inset-[9%] rounded-full bg-cyan-400/20 blur-3xl"
          animate={{ opacity: talking ? [0.25, 0.52, 0.25] : [0.18, 0.32, 0.18], scale: talking ? [0.94, 1.05, 0.94] : 1 }}
          transition={{ duration: talking ? 1.1 : 3, repeat: Infinity }} />
      )}

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

