"use client";
import { motion } from "framer-motion";
import type { CallState } from "@/types";

interface MontoAvatarProps {
  callState: CallState;
  size?: number;
}

/**
 * Animated Monto box avatar — reacts to call state with visual cues.
 */
export function MontoAvatar({ callState, size = 120 }: MontoAvatarProps) {
  const isActive   = callState === "in-call";
  const isCalling  = callState === "calling" || callState === "incoming";
  const isOffline  = callState === "unregistered" || callState === "error";

  const ringColor = isActive
    ? "#059669"
    : isCalling
      ? "#7C3AED"
      : "#2D2D4A";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer pulse ring — shows when calling / active */}
      {(isActive || isCalling) && (
        <>
          <motion.div
            className="absolute rounded-full"
            style={{
              width:  size + 24,
              height: size + 24,
              border: `2px solid ${ringColor}`,
              opacity: 0.5,
            }}
            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.15, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{
              width:  size + 48,
              height: size + 48,
              border: `2px solid ${ringColor}`,
              opacity: 0.25,
            }}
            animate={{ scale: [1, 1.14, 1], opacity: [0.25, 0.05, 0.25] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          />
        </>
      )}

      {/* Avatar circle */}
      <motion.div
        className="relative flex items-center justify-center rounded-full overflow-hidden"
        style={{ width: size, height: size }}
        animate={
          isCalling
            ? { rotate: [0, 8, -8, 0] }
            : isActive
              ? { scale: [1, 1.03, 1] }
              : {}
        }
        transition={
          isCalling
            ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
            : isActive
              ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
              : {}
        }
      >
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: isOffline
              ? "linear-gradient(135deg, #1A1A2E 0%, #2D2D4A 100%)"
              : isActive
                ? "linear-gradient(135deg, #059669 0%, #2563EB 100%)"
                : isCalling
                  ? "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)"
                  : "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          }}
        />

        {/* Monto face emoji / icon */}
        <span
          className="relative select-none"
          style={{ fontSize: size * 0.42, lineHeight: 1 }}
          aria-hidden="true"
        >
          {isOffline ? "📦" : isActive ? "🤖" : isCalling ? "📞" : "🤖"}
        </span>
      </motion.div>

      {/* "Monto" label */}
      <div
        className="absolute -bottom-7 text-center text-sm font-semibold text-zinc-300"
        style={{ width: size + 32, left: "50%", transform: "translateX(-50%)" }}
      >
        Monto Box
      </div>
    </div>
  );
}
