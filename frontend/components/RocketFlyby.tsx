"use client";
import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";

function RocketSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 60 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M30 4c12 14 16 34 12 54-2 10-6 18-12 24-6-6-10-14-12-24-4-20 0-40 12-54z" fill="#F8FAFC" stroke="#E11D48" strokeWidth="3" />
      <circle cx="30" cy="34" r="9" fill="#DBEAFE" stroke="#2563EB" strokeWidth="3" />
      <path d="M18 58c-8 2-14 10-16 20 8-2 16-6 20-12z" fill="#E11D48" />
      <path d="M42 58c8 2 14 10 16 20-8-2-16-6-20-12z" fill="#E11D48" />
      <path d="M24 78h12l-2 10a4 4 0 0 1-8 0z" fill="#FBBF24" />
    </svg>
  );
}

/** Layered vector flame (outer orange-red, inner yellow-orange core) so the
 *  engine exhaust matches the rocket's clean hand-drawn art instead of
 *  looking like a stray 🔥 emoji glued underneath it. */
function FlameSVG({ size }: { size: number }) {
  const uid = useId();
  const outerId = `flame-outer-${uid}`;
  const innerId = `flame-inner-${uid}`;
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={outerId} x1="20" y1="0" x2="20" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="55%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
        <linearGradient id={innerId} x1="20" y1="10" x2="20" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="60%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
      <path d="M20 0c10 14 16 26 16 36 0 13-7 22.5-16 24-9-1.5-16-11-16-24 0-10 6-22 16-36z" fill={`url(#${outerId})`} />
      <path d="M20 11c6.5 9.5 10 17.5 10 24 0 8-4 14-10 16-6-2-10-8-10-16 0-6.5 3.5-14.5 10-24z" fill={`url(#${innerId})`} />
    </svg>
  );
}

const SPARK_SPOTS = [
  { left: "30%", delay: 0 },
  { left: "68%", delay: 0.25 },
  { left: "40%", delay: 0.5 },
  { left: "60%", delay: 0.75 },
  { left: "48%", delay: 1 },
  { left: "52%", delay: 1.25 },
];

/** Character sits astride the rocket and rides it up and off-screen —
 *  the idle "I'm bored, let's fly!" easter egg. */
export function RocketFlyby({ children, size = 300 }: { children: ReactNode; size?: number }) {
  const rocketSize = size * 0.62;

  return (
    <div className="relative flex items-end justify-center overflow-visible" style={{ width: size, height: size * 1.15 }}>
      <motion.div
        className="relative"
        style={{ width: size, height: rocketSize * 1.6 }}
        initial={{ y: 30, opacity: 0, rotate: 0 }}
        animate={{
          y: [30, -10, -70, -160, -260],
          x: [0, 14, -12, 12, -6],
          rotate: [2, -6, 6, -4, 2],
          opacity: [0, 1, 1, 1, 0],
        }}
        transition={{ duration: 4.4, ease: "easeInOut", times: [0, 0.18, 0.4, 0.72, 1] }}
      >
        {/* Subtle continuous ride-jostle, nested so it layers on top of the flight arc */}
        <motion.div
          className="relative w-full h-full"
          animate={{ y: [0, -4, 0, 3, 0], rotate: [0, 1.5, 0, -1.5, 0] }}
          transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Rocket — anchored to the bottom, behind the character */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0" style={{ zIndex: 1 }}>
            <RocketSVG size={rocketSize} />
          </div>

          {/* Character — straddled onto the rocket's nose so it reads as "riding" */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: rocketSize * 1.6 * 0.62, zIndex: 2 }}
          >
            {children}
          </div>

          {/* Engine flame, flickering beneath the rocket */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none origin-top"
            style={{ bottom: -rocketSize * 0.34 }}
            animate={{ opacity: [1, 0.6, 1], scaleY: [1, 1.35, 1] }}
            transition={{ duration: 0.2, repeat: Infinity }}
          >
            <FlameSVG size={rocketSize * 0.34} />
          </motion.div>
        </motion.div>
      </motion.div>

      {SPARK_SPOTS.map((spot, i) => (
        <motion.span
          key={i}
          className="absolute text-base pointer-events-none select-none"
          style={{ left: spot.left, bottom: `${4 + i * 7}%` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0], y: [0, 26] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: spot.delay }}
        >
          ✨
        </motion.span>
      ))}
    </div>
  );
}
