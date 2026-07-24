"use client";
/**
 * ExerciseFigureArt — animated cartoon kid character performing the Move
 * page's PT exercises (march, reach, bend, jump, knee, touch, balance,
 * breathe). Visual style (skin/hair/outline) matches components/YogaPoseArt,
 * but here each limb is its own rotating group so the figure actually moves
 * through the exercise instead of holding one static pose.
 */
import { motion } from "framer-motion";

type ExerciseId = "march" | "reach" | "bend" | "jump" | "knee" | "touch" | "balance" | "breathe";

interface Props {
  exerciseId: ExerciseId;
  color: string;
  size?: number;
  paused?: boolean;
}

type Pt = { x: number; y: number };

const SKIN = "#F3B889";
const SKIN_SHADE = "#E29E68";
const HAIR = "#4A3226";
const OUTLINE = "#0B1220";

// ── Anchor points for a forward-facing standing figure ───────────────────────
const HEAD: Pt = { x: 100, y: 36 };
const SHOULDER_L: Pt = { x: 85, y: 60 };
const SHOULDER_R: Pt = { x: 115, y: 60 };
const HIP_L: Pt = { x: 91, y: 126 };
const HIP_R: Pt = { x: 109, y: 126 };
const ARM_LEN = 46;
const LEG_LEN = 60;

function Limb({ a, b, width, color }: { a: Pt; b: Pt; width: number; color: string }) {
  return (
    <>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={OUTLINE} strokeOpacity={0.4} strokeWidth={width + 4} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} strokeLinecap="round" />
    </>
  );
}

function Tip({ p, r = 8, color = SKIN }: { p: Pt; r?: number; color?: string }) {
  return (
    <>
      <circle cx={p.x} cy={p.y} r={r + 2} fill={OUTLINE} opacity={0.4} />
      <circle cx={p.x} cy={p.y} r={r} fill={color} />
    </>
  );
}

/** A limb that hangs straight down from `pivot` at rest — animating `rotate`
 * on its own group swings it forward/back/out around that joint. */
function RotatingLimb({
  pivot, length, width, color, tipColor, animate, duration, delay = 0, ease = "easeInOut",
}: {
  pivot: Pt; length: number; width: number; color: string; tipColor?: string;
  animate: number[]; duration: number; delay?: number; ease?: string | [number, number, number, number];
}) {
  const end: Pt = { x: pivot.x, y: pivot.y + length };
  return (
    <motion.g
      style={{ transformOrigin: `${pivot.x}px ${pivot.y}px` }}
      animate={{ rotate: animate }}
      transition={{ duration, repeat: Infinity, ease, delay }}
    >
      <Limb a={pivot} b={end} width={width} color={color} />
      <Tip p={end} r={width / 2 + 1} color={tipColor} />
    </motion.g>
  );
}

function Head({ p, tilt = [0] as number[], duration = 3, look = 0 }: { p: Pt; tilt?: number[]; duration?: number; look?: number }) {
  return (
    <motion.g style={{ transformOrigin: `${p.x}px ${p.y}px` }} animate={{ rotate: tilt }} transition={{ duration, repeat: Infinity, ease: "easeInOut" }}>
      <circle cx={p.x} cy={p.y} r={19} fill={OUTLINE} opacity={0.4} />
      <circle cx={p.x} cy={p.y} r={17} fill="url(#exFigSkinGrad)" />
      <path transform={`translate(${p.x} ${p.y})`} d="M-16,-4 Q-18,-22 0,-22 Q18,-22 16,-4 Q10,-16 0,-16 Q-10,-16 -16,-4 Z" fill={HAIR} />
      <g transform={`translate(${p.x + look} ${p.y + 2})`}>
        {/* Cheeks flush warm during effort — sits behind the eyes/mouth */}
        <circle cx={-11} cy={5} r={3.4} fill="#F472B6" opacity={0.4} />
        <circle cx={11} cy={5} r={3.4} fill="#F472B6" opacity={0.4} />
        {/* Eyes blink on their own independent loop so the figure feels alive
            even mid-pose, not just mid-swing. */}
        <motion.g animate={{ scaleY: [1, 1, 0.1, 1, 1] }} transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.86, 0.9, 0.94, 1], ease: "easeInOut" }} style={{ transformOrigin: "0px 1px" }}>
          <circle cx={-6} cy={1} r={1.9} fill="#2A2A2A" />
          <circle cx={6} cy={1} r={1.9} fill="#2A2A2A" />
        </motion.g>
        <path d="M-6,7 Q0,11 6,7" stroke="#2A2A2A" strokeWidth={1.6} strokeLinecap="round" fill="none" />
      </g>
    </motion.g>
  );
}

/** Little energy sparkles that orbit the figure during high-effort moves —
 * pure delight, no functional weight, so they're the first thing skipped
 * when `active` is false. */
function EffortSparkles({ active, color }: { active: boolean; color: string }) {
  if (!active) return null;
  const spots = [{ x: 46, y: 70, d: 0 }, { x: 154, y: 66, d: 0.4 }, { x: 40, y: 110, d: 0.8 }, { x: 160, y: 112, d: 1.2 }];
  return (
    <>
      {spots.map((s, i) => (
        <motion.circle
          key={i}
          cx={s.x} cy={s.y} r={3.5}
          fill={color}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.3, 1.2, 0.3], y: [0, -14, -22] }}
          transition={{ duration: 1.3, repeat: Infinity, delay: s.d, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

// ── Per-exercise motion recipes ───────────────────────────────────────────────
// All rotation keyframes are degrees around the shoulder/hip pivot, where 0 =
// the limb hanging straight down at rest.
const RECIPES: Record<ExerciseId, {
  duration: number;
  bodyY?: number[];
  bodyScaleY?: number[];
  torsoRotate?: number[];
  headTilt?: number[];
  armL: number[]; armR: number[]; legL: number[]; legR: number[];
  armDelay?: number; legDelay?: number;
  effort?: boolean;
  ease?: [number, number, number, number];
}> = {
  march: {
    duration: 0.8,
    bodyY: [0, -4, 0, -4, 0],
    bodyScaleY: [1, 0.97, 1, 0.97, 1],
    armL: [30, -25, 30], armR: [-25, 30, -25],
    legL: [-35, 25, -35], legR: [25, -35, 25],
    effort: true,
    ease: [0.34, 1.4, 0.64, 1],
  },
  reach: {
    duration: 1.6,
    bodyY: [0, -6, 0],
    bodyScaleY: [1, 1.06, 1],
    armL: [10, -170, 10], armR: [-10, 170, -10],
    legL: [-4, 4, -4], legR: [4, -4, 4],
  },
  bend: {
    duration: 1.8,
    torsoRotate: [-22, 22, -22],
    armL: [20, 20, 20], armR: [-20, -20, -20],
    legL: [-3, 3, -3], legR: [3, -3, 3],
  },
  jump: {
    duration: 0.9,
    bodyY: [0, -26, 0],
    bodyScaleY: [0.9, 1.1, 0.9],
    armL: [10, -165, 10], armR: [-10, 165, -10],
    legL: [-6, -46, -6], legR: [6, 46, 6],
    effort: true,
    ease: [0.34, 1.56, 0.64, 1],
  },
  knee: {
    duration: 0.7,
    bodyY: [0, -3, 0, -3, 0],
    bodyScaleY: [1, 0.96, 1, 0.96, 1],
    armL: [40, -35, 40], armR: [-35, 40, -35],
    legL: [-8, -100, -8], legR: [-100, -8, -100],
    effort: true,
    ease: [0.34, 1.4, 0.64, 1],
  },
  touch: {
    duration: 1.9,
    torsoRotate: [0, 46, 0],
    armL: [8, 60, 8], armR: [-8, 60, -8],
    legL: [-2, 2, -2], legR: [2, -2, 2],
  },
  balance: {
    duration: 2.6,
    torsoRotate: [-3, 3, -3],
    armL: [-165, -160, -165], armR: [165, 160, 165],
    legL: [-2, 2, -2], legR: [82, 78, 82],
  },
  breathe: {
    duration: 3,
    bodyScaleY: [1, 1.07, 1],
    armL: [30, 5, 30], armR: [-30, -5, -30],
    legL: [0, 0, 0], legR: [0, 0, 0],
    headTilt: [0, 2, 0],
  },
};

export function ExerciseFigureArt({ exerciseId, color, size = 200, paused = false }: Props) {
  const r = RECIPES[exerciseId];
  const outfit = "url(#exFigOutfitGrad)";
  const dur = paused ? 999 : r.duration;
  const ease = r.ease ?? "easeInOut";

  return (
    <motion.svg viewBox="0 0 200 200" width={size} height={size} animate={{ y: paused ? 0 : r.bodyY }} transition={{ duration: dur, repeat: Infinity, ease }}>
      <defs>
        <linearGradient id="exFigSkinGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_SHADE} />
        </linearGradient>
        <linearGradient id="exFigOutfitGrad" x1="0" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} stopOpacity={0.92} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>

      {/* Shadow breathes opposite the body — shrinks as the figure lifts off,
          which is what sells a jump far more than the limb motion alone. */}
      <motion.ellipse
        cx={100} cy={190} rx={54} ry={7} fill="#000" opacity={0.16}
        animate={{ scaleX: paused ? 1 : (r.bodyY ? r.bodyY.map(y => 1 - Math.abs(y) / 130) : 1) }}
        transition={{ duration: dur, repeat: Infinity, ease }}
        style={{ transformOrigin: "100px 190px" }}
      />

      <motion.g style={{ transformOrigin: "100px 126px" }} animate={{ rotate: paused ? 0 : r.torsoRotate, scaleY: paused ? 1 : r.bodyScaleY }} transition={{ duration: dur, repeat: Infinity, ease }}>
        {/* Legs drawn first so they tuck behind the torso outline */}
        <RotatingLimb pivot={HIP_L} length={LEG_LEN} width={16} color={SKIN} animate={paused ? [0] : r.legL} duration={dur} ease={ease} />
        <RotatingLimb pivot={HIP_R} length={LEG_LEN} width={16} color={SKIN} animate={paused ? [0] : r.legR} duration={dur} ease={ease} />

        <Limb a={{ x: 100, y: 54 }} b={{ x: 100, y: 132 }} width={32} color={outfit} />

        <RotatingLimb pivot={SHOULDER_L} length={ARM_LEN} width={13} color={SKIN} animate={paused ? [0] : r.armL} duration={dur} ease={ease} />
        <RotatingLimb pivot={SHOULDER_R} length={ARM_LEN} width={13} color={SKIN} animate={paused ? [0] : r.armR} duration={dur} ease={ease} />

        <Head p={HEAD} tilt={paused ? [0] : (r.headTilt ?? [0])} duration={dur} />
      </motion.g>

      <EffortSparkles active={!paused && !!r.effort} color={color} />
    </motion.svg>
  );
}
