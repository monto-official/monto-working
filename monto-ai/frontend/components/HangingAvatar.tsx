"use client";
/**
 * HangingAvatar — Spider-Man style hanging animation for Monto.
 * Wraps the existing Avatar component with:
 *  - Idle hang: swings left/right on silk thread from top-center
 *  - Listening: climbs up the thread into the web
 *  - Speaking: glowing web pulse, hidden body
 *  - Post-speak: climbs back down, resumes idle swing
 *  - Random idle micro-behaviors: blink, head tilt, hand adjust, bounce
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Avatar } from "@/components/Avatar";
import type { Emotion } from "@/types";

interface Props {
  emotion:     Emotion;
  size?:       number;
  isListening: boolean;
  isSpeaking:  boolean;
}

type HangState = "idle" | "climbing-up" | "hidden" | "speaking" | "climbing-down";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function HangingAvatar({ emotion, size = 220, isListening, isSpeaking }: Props) {
  const [hangState,  setHangState]  = useState<HangState>("idle");
  const [threadLen,  setThreadLen]  = useState(120);   // px — silk thread length
  const [swing,      setSwing]      = useState(0);     // rotation degrees
  const [headTilt,   setHeadTilt]   = useState(0);
  const [eyesBlink,  setEyesBlink]  = useState(false);
  const [peekEyes,   setPeekEyes]   = useState(false);
  const [webPulse,   setWebPulse]   = useState(false);
  const [mounted,    setMounted]    = useState(false);

  const idleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bodyCtrl   = useAnimation();

  // ── Idle swing loop ────────────────────────────────────────────────────────
  const startIdleSwing = useCallback(() => {
    bodyCtrl.start({
      rotate: [0, 3, 0, -3, 0, 2, 0, -2, 0],
      y:      [0, -4, 0, -4, 0, -2, 0, -3, 0],
      transition: {
        duration:   7,
        repeat:     Infinity,
        ease:       "easeInOut",
        times:      [0, 0.15, 0.3, 0.45, 0.6, 0.7, 0.8, 0.9, 1],
      },
    });
  }, [bodyCtrl]);

  // ── Random idle micro-behaviours ───────────────────────────────────────────
  const scheduleIdleBehaviors = useCallback(() => {
    // Blink every 3–7s
    const blinkLoop = () => {
      const t = setTimeout(() => {
        setEyesBlink(true);
        setTimeout(() => setEyesBlink(false), 130);
        blinkLoop();
      }, rand(3000, 7000));
      idleTimers.current.push(t);
    };
    blinkLoop();

    // Head tilt every 8–14s
    const tiltLoop = () => {
      const t = setTimeout(() => {
        const angle = rand(-6, 6);
        setHeadTilt(angle);
        setTimeout(() => setHeadTilt(0), 1400);
        tiltLoop();
      }, rand(8000, 14000));
      idleTimers.current.push(t);
    };
    tiltLoop();

    // Occasional extra rotation then back
    const quirk = () => {
      const t = setTimeout(() => {
        bodyCtrl.start({
          rotate: [0, rand(4, 8) * (Math.random() > 0.5 ? 1 : -1), 0],
          transition: { duration: 2, ease: "easeInOut" },
        });
        quirk();
      }, rand(15000, 25000));
      idleTimers.current.push(t);
    };
    quirk();
  }, [bodyCtrl]);

  const clearIdleTimers = () => {
    idleTimers.current.forEach(clearTimeout);
    idleTimers.current = [];
  };

  // ── Initial idle ───────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    startIdleSwing();
    scheduleIdleBehaviors();
    return clearIdleTimers;
  }, [startIdleSwing, scheduleIdleBehaviors]);

  // ── React to listening / speaking state ────────────────────────────────────
  useEffect(() => {
    if (isListening && hangState === "idle") {
      // Stop idle
      bodyCtrl.stop();
      clearIdleTimers();
      setHangState("climbing-up");

      // Animate: thread shortens, body climbs up
      bodyCtrl.start({
        y:      -threadLen - 60,
        rotate: [swing, 0],
        scale:  [1, 0.85],
        transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] },
      }).then(() => {
        setHangState("hidden");
        setThreadLen(0);
        // Peek eyes after 0.3s
        setTimeout(() => setPeekEyes(true), 300);
      });
    }

    if (!isListening && !isSpeaking && hangState === "hidden") {
      setPeekEyes(false);
      setHangState("climbing-down");
      setThreadLen(120);

      // After 1s, descend back
      const t = setTimeout(() => {
        bodyCtrl.start({
          y:     0,
          scale: 1,
          rotate: 0,
          transition: {
            duration: 1.2,
            ease:     [0.4, 0, 0.2, 1],
          },
        }).then(() => {
          setHangState("idle");
          startIdleSwing();
          scheduleIdleBehaviors();
        });
      }, 1000);
      idleTimers.current.push(t);
    }

    if (isSpeaking && hangState === "hidden") {
      setHangState("speaking");
      setPeekEyes(false);
      setWebPulse(true);
    }

    if (!isSpeaking && hangState === "speaking") {
      setWebPulse(false);
      setHangState("hidden");
      setPeekEyes(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, isSpeaking]);

  // Thread stretch: slightly longer when body swings far
  const dynamicThread = Math.min(threadLen + Math.abs(swing) * 0.8, 140);

  const isHidden = hangState === "hidden" || hangState === "speaking" || hangState === "climbing-up";

  if (!mounted) return (
    <div style={{ width: size, minHeight: size + 160 }} className="relative flex flex-col items-center">
      <div style={{ marginTop: 120 }}>
        <Avatar emotion={emotion} size={size} />
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, minHeight: size + 160 }}>

      {/* ── Silk thread ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {threadLen > 0 && (
          <motion.svg
            key="thread"
            className="absolute top-0 left-1/2 pointer-events-none"
            style={{ transform: "translateX(-50%)", zIndex: 2 }}
            width="6"
            height={dynamicThread + 8}
            overflow="visible"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            <defs>
              <filter id="thread-glow">
                <feGaussianBlur stdDeviation="1" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            {/* Outer glow thread */}
            <motion.line
              x1="3" y1="0" x2="3" y2={dynamicThread}
              stroke="rgba(220,235,255,0.25)"
              strokeWidth="3"
              filter="url(#thread-glow)"
              animate={{ y2: [dynamicThread, dynamicThread + 2, dynamicThread] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Main silk thread */}
            <motion.line
              x1="3" y1="0" x2="3" y2={dynamicThread}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="0.9"
              animate={{ y2: [dynamicThread, dynamicThread + 2, dynamicThread] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.svg>
        )}
      </AnimatePresence>

      {/* ── Climbing animation ────────────────────────────────────────────── */}
      <AnimatePresence>
        {(hangState === "climbing-up" || hangState === "climbing-down") && (
          <motion.div
            key="climb-hands"
            className="absolute pointer-events-none"
            style={{ top: hangState === "climbing-up" ? 0 : threadLen, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}
          >
            {/* Spider-Man climbing hands along thread */}
            {[0, 1].map(i => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{ background: "#CC0000", left: i === 0 ? -12 : 8, top: 0, zIndex: 10 }}
                animate={{
                  y: hangState === "climbing-up"
                    ? [0, -20, -40, -60, -80]
                    : [0, 20, 40, 60, 80],
                  x: [0, i === 0 ? -4 : 4, 0, i === 0 ? -4 : 4, 0],
                }}
                transition={{ duration: 0.7, delay: i * 0.15, ease: "linear" }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Peekaboo eyes when hidden ─────────────────────────────────────── */}
      <AnimatePresence>
        {peekEyes && (
          <motion.div
            key="peek"
            className="absolute pointer-events-none"
            style={{ top: 4, left: "50%", transform: "translateX(-50%)", zIndex: 20 }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            <svg width="48" height="20" viewBox="0 0 48 20">
              <defs>
                <filter id="eye-peek-glow">
                  <feGaussianBlur stdDeviation="2.5" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {/* Left eye glow */}
              <ellipse cx="14" cy="12" rx="8" ry="5" fill="white" opacity="0.2" filter="url(#eye-peek-glow)"/>
              <ellipse cx="14" cy="12" rx="6" ry="4" fill="#E0F0FF" opacity="0.85" filter="url(#eye-peek-glow)"/>
              {/* Right eye glow */}
              <ellipse cx="34" cy="12" rx="8" ry="5" fill="white" opacity="0.2" filter="url(#eye-peek-glow)"/>
              <ellipse cx="34" cy="12" rx="6" ry="4" fill="#E0F0FF" opacity="0.85" filter="url(#eye-peek-glow)"/>
              {/* Blink if eyesBlink */}
              {eyesBlink && <>
                <line x1="8" y1="12" x2="20" y2="12" stroke="#E0F0FF" strokeWidth="2" strokeLinecap="round"/>
                <line x1="28" y1="12" x2="40" y2="12" stroke="#E0F0FF" strokeWidth="2" strokeLinecap="round"/>
              </>}
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Web speaking pulse ────────────────────────────────────────────── */}
      <AnimatePresence>
        {webPulse && (
          <motion.div
            key="web-pulse"
            className="absolute pointer-events-none rounded-full"
            style={{ top: -20, left: "50%", transform: "translateX(-50%)", zIndex: 3 }}
            initial={{ width: 20, height: 20, opacity: 0 }}
            animate={{
              width:   [20, 120, 20],
              height:  [20, 120, 20],
              opacity: [0, 0.25, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{
              marginLeft: -60, marginTop: -60,
              background: "radial-gradient(circle, rgba(147,197,253,0.4) 0%, transparent 70%)",
            } as React.CSSProperties}
          />
        )}
      </AnimatePresence>

      {/* ── The Avatar body ───────────────────────────────────────────────── */}
      <motion.div
        animate={bodyCtrl}
        style={{
          marginTop: threadLen,
          transformOrigin: "top center",
          willChange: "transform",
          zIndex: 5,
          position: "relative",
        }}
        initial={{ y: 0, rotate: 0, scale: 1 }}
      >
        {/* Head tilt micro-behavior */}
        <motion.div
          animate={{ rotate: headTilt }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          style={{ transformOrigin: "top center" }}
        >
          <AnimatePresence>
            {!isHidden && (
              <motion.div
                key="avatar-body"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <Avatar emotion={eyesBlink ? "neutral" : emotion} size={size} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}
