"use client";
/**
 * YogaPoseArt — cute proportioned-character illustrations for kids' yoga poses.
 * Drawn as inline SVG (no external image assets needed) so it stays fully
 * offline and matches the app's existing hand-drawn avatar style, but with
 * a real head/torso/limb body instead of plain stick lines.
 */
import { motion } from "framer-motion";

interface Props {
  poseId: string;
  color: string;
  size?: number;
}

type Pt = { x: number; y: number };

const SKIN = "#F3B889";
const SKIN_SHADE = "#E29E68";
const HAIR = "#4A3226";
const OUTLINE = "#0B1220";

// ── Shared body-part primitives ──────────────────────────────────────────────
// Each part draws a darker, slightly-wider outline copy of itself first so the
// figure reads clearly against any (same-hued) card background — plain SVG
// stroking, no filter primitives, so it renders identically everywhere
// (including the Android WebView this app ships in via Capacitor).
function Limb({ a, b, width, color }: { a: Pt; b: Pt; width: number; color: string }) {
  return (
    <>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={OUTLINE} strokeOpacity={0.4} strokeWidth={width + 4} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={color} strokeWidth={width} strokeLinecap="round" />
    </>
  );
}

function Spine({ d, width, color }: { d: string; width: number; color: string }) {
  return (
    <>
      <path d={d} stroke={OUTLINE} strokeOpacity={0.4} strokeWidth={width + 4} strokeLinecap="round" fill="none" />
      <path d={d} stroke={color} strokeWidth={width} strokeLinecap="round" fill="none" />
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

function Head({ p, tilt = 0, look = 0 }: { p: Pt; tilt?: number; look?: number }) {
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${tilt})`}>
      <circle r={19} fill={OUTLINE} opacity={0.4} />
      <circle r={17} fill="url(#skinGrad)" />
      {/* Hair */}
      <path d="M-16,-4 Q-18,-22 0,-22 Q18,-22 16,-4 Q10,-16 0,-16 Q-10,-16 -16,-4 Z" fill={HAIR} />
      <path d="M12,-2 Q19,2 15,10" stroke={HAIR} strokeWidth={5} strokeLinecap="round" fill="none" />
      {/* Face */}
      <g transform={`translate(${look} 2)`}>
        <circle cx={-6} cy={1} r={1.8} fill="#2A2A2A" />
        <circle cx={6} cy={1} r={1.8} fill="#2A2A2A" />
        <path d="M-6,7 Q0,11 6,7" stroke="#2A2A2A" strokeWidth={1.6} strokeLinecap="round" fill="none" />
        <circle cx={-11} cy={5} r={3} fill="#F472B6" opacity={0.35} />
        <circle cx={11} cy={5} r={3} fill="#F472B6" opacity={0.35} />
      </g>
    </g>
  );
}

// ── Ground mat + contact shadow (adds scene context / grounding) ────────────
// Kept outside the character's outline filter so the soft shadow stays soft.
const SHADOWS: Record<string, { cx: number; cy: number; rx: number }> = {
  mountain:   { cx: 120, cy: 208, rx: 44 },
  tree:       { cx: 132, cy: 208, rx: 28 },
  cat:        { cx: 120, cy: 194, rx: 90 },
  cow:        { cx: 120, cy: 194, rx: 90 },
  downdog:    { cx: 122, cy: 196, rx: 96 },
  cobra:      { cx: 110, cy: 186, rx: 100 },
  butterfly:  { cx: 120, cy: 190, rx: 66 },
  childpose:  { cx: 110, cy: 190, rx: 96 },
};

function Scene({ poseId }: { poseId: string }) {
  const shadow = SHADOWS[poseId] ?? { cx: 120, cy: 200, rx: 60 };
  return (
    <>
      <rect x={16} y={196} width={208} height={16} rx={8} fill="url(#matGrad)" opacity={0.5} />
      <ellipse cx={shadow.cx} cy={shadow.cy} rx={shadow.rx} ry={7} fill="#000" opacity={0.18} />
    </>
  );
}

function Defs({ color }: { color: string }) {
  return (
    <defs>
      <linearGradient id="skinGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={SKIN} />
        <stop offset="100%" stopColor={SKIN_SHADE} />
      </linearGradient>
      {/* userSpaceOnUse (not the default objectBoundingBox) so this still
          renders on perfectly axis-aligned shapes — e.g. a straight vertical
          <line> torso has a zero-width bounding box, which makes an
          objectBoundingBox gradient degenerate and invisible. */}
      <linearGradient id="outfitGrad" x1="0" y1="0" x2="0" y2="220" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={color} stopOpacity={0.9} />
        <stop offset="100%" stopColor={color} />
      </linearGradient>
      <linearGradient id="matGrad" x1="16" y1="0" x2="224" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={color} stopOpacity={0.15} />
        <stop offset="50%" stopColor={color} stopOpacity={0.45} />
        <stop offset="100%" stopColor={color} stopOpacity={0.15} />
      </linearGradient>
    </defs>
  );
}

function Figure({ poseId }: { poseId: string }) {
  const outfit = "url(#outfitGrad)";

  switch (poseId) {
    // Standing tall, feet together, arms relaxed
    case "mountain":
      return (
        <>
          <Limb a={{ x: 111, y: 126 }} b={{ x: 100, y: 204 }} width={15} color={SKIN} />
          <Limb a={{ x: 129, y: 126 }} b={{ x: 140, y: 204 }} width={15} color={SKIN} />
          <Tip p={{ x: 100, y: 206 }} r={9} />
          <Tip p={{ x: 140, y: 206 }} r={9} />
          <Limb a={{ x: 120, y: 58 }} b={{ x: 120, y: 132 }} width={30} color={outfit} />
          <Limb a={{ x: 111, y: 66 }} b={{ x: 90, y: 122 }} width={13} color={SKIN} />
          <Limb a={{ x: 129, y: 66 }} b={{ x: 150, y: 122 }} width={13} color={SKIN} />
          <Tip p={{ x: 90, y: 124 }} r={8} />
          <Tip p={{ x: 150, y: 124 }} r={8} />
          <Head p={{ x: 120, y: 40 }} />
        </>
      );

    // Balance on one leg, hands together overhead
    case "tree":
      return (
        <>
          <Limb a={{ x: 129, y: 120 }} b={{ x: 140, y: 204 }} width={15} color={SKIN} />
          <Tip p={{ x: 140, y: 206 }} r={9} />
          <Limb a={{ x: 111, y: 120 }} b={{ x: 145, y: 150 }} width={14} color={SKIN} />
          <Limb a={{ x: 145, y: 150 }} b={{ x: 122, y: 132 }} width={12} color={SKIN} />
          <Tip p={{ x: 122, y: 132 }} r={9} />
          <Limb a={{ x: 120, y: 54 }} b={{ x: 120, y: 126 }} width={28} color={outfit} />
          <Limb a={{ x: 111, y: 58 }} b={{ x: 120, y: 4 }} width={13} color={SKIN} />
          <Limb a={{ x: 129, y: 58 }} b={{ x: 120, y: 4 }} width={13} color={SKIN} />
          <Tip p={{ x: 120, y: 4 }} r={9} />
          <Head p={{ x: 120, y: 34 }} />
        </>
      );

    // Tabletop, spine arched UP like a scared cat, head tucked
    case "cat":
      return (
        <>
          <Limb a={{ x: 168, y: 106 }} b={{ x: 168, y: 182 }} width={15} color={SKIN} />
          <Tip p={{ x: 168, y: 184 }} r={9} />
          <Limb a={{ x: 76, y: 110 }} b={{ x: 76, y: 182 }} width={14} color={SKIN} />
          <Tip p={{ x: 76, y: 184 }} r={8} />
          <Spine d="M76,110 Q120,48 168,106" width={26} color={outfit} />
          <Head p={{ x: 60, y: 122 }} tilt={35} look={-2} />
        </>
      );

    // Tabletop, belly sags down, head & tail lift up
    case "cow":
      return (
        <>
          <Limb a={{ x: 168, y: 96 }} b={{ x: 168, y: 182 }} width={15} color={SKIN} />
          <Tip p={{ x: 168, y: 184 }} r={9} />
          <Limb a={{ x: 76, y: 100 }} b={{ x: 76, y: 182 }} width={14} color={SKIN} />
          <Tip p={{ x: 76, y: 184 }} r={8} />
          <Spine d="M76,100 Q120,158 168,96" width={26} color={outfit} />
          <Head p={{ x: 60, y: 74 }} tilt={-30} look={2} />
        </>
      );

    // Inverted V — hips high, hands and feet on the floor
    case "downdog":
      return (
        <>
          <Limb a={{ x: 60, y: 182 }} b={{ x: 96, y: 122 }} width={13} color={SKIN} />
          <Tip p={{ x: 60, y: 184 }} r={8} />
          <Limb a={{ x: 96, y: 122 }} b={{ x: 122, y: 84 }} width={26} color={outfit} />
          <Limb a={{ x: 122, y: 84 }} b={{ x: 158, y: 128 }} width={15} color={SKIN} />
          <Limb a={{ x: 158, y: 128 }} b={{ x: 190, y: 182 }} width={13} color={SKIN} />
          <Tip p={{ x: 190, y: 184 }} r={9} />
          <Head p={{ x: 90, y: 136 }} tilt={-55} look={2} />
        </>
      );

    // Lying on tummy, chest lifted like a cobra
    case "cobra":
      return (
        <>
          <Limb a={{ x: 55, y: 178 }} b={{ x: 130, y: 178 }} width={15} color={SKIN} />
          <Tip p={{ x: 55, y: 178 }} r={9} />
          <Limb a={{ x: 130, y: 178 }} b={{ x: 165, y: 135 }} width={26} color={outfit} />
          <Limb a={{ x: 165, y: 135 }} b={{ x: 150, y: 168 }} width={12} color={SKIN} />
          <Limb a={{ x: 150, y: 168 }} b={{ x: 172, y: 178 }} width={11} color={SKIN} />
          <Tip p={{ x: 172, y: 178 }} r={8} />
          <Head p={{ x: 186, y: 112 }} tilt={70} look={-2} />
        </>
      );

    // Seated, soles of feet together, knees out like wings
    case "butterfly":
      return (
        <>
          <Limb a={{ x: 111, y: 124 }} b={{ x: 66, y: 118 }} width={14} color={SKIN} />
          <Limb a={{ x: 66, y: 118 }} b={{ x: 103, y: 155 }} width={12} color={SKIN} />
          <Limb a={{ x: 129, y: 124 }} b={{ x: 174, y: 118 }} width={14} color={SKIN} />
          <Limb a={{ x: 174, y: 118 }} b={{ x: 137, y: 155 }} width={12} color={SKIN} />
          <Tip p={{ x: 103, y: 156 }} r={8} />
          <Tip p={{ x: 137, y: 156 }} r={8} />
          <Limb a={{ x: 120, y: 58 }} b={{ x: 120, y: 128 }} width={28} color={outfit} />
          <Limb a={{ x: 111, y: 64 }} b={{ x: 96, y: 148 }} width={12} color={SKIN} />
          <Limb a={{ x: 129, y: 64 }} b={{ x: 144, y: 148 }} width={12} color={SKIN} />
          <Head p={{ x: 120, y: 38 }} />
        </>
      );

    // Kneeling, forehead down, arms stretched forward
    case "childpose":
      return (
        <>
          <Limb a={{ x: 178, y: 150 }} b={{ x: 190, y: 188 }} width={14} color={SKIN} />
          <Tip p={{ x: 190, y: 190 }} r={9} />
          <Spine d="M178,150 Q140,168 120,170" width={24} color={outfit} />
          <Limb a={{ x: 120, y: 170 }} b={{ x: 60, y: 170 }} width={12} color={SKIN} />
          <Tip p={{ x: 58, y: 170 }} r={8} />
          <Head p={{ x: 50, y: 172 }} tilt={90} look={2} />
        </>
      );

    default:
      return <circle cx={120} cy={100} r={40} fill={SKIN} opacity={0.3} />;
  }
}

export function YogaPoseArt({ poseId, color, size = 200 }: Props) {
  return (
    <motion.svg
      viewBox="0 0 240 220"
      width={size}
      height={size * (220 / 240)}
      animate={{ scale: [1, 1.025, 1] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <Defs color={color} />
      <Scene poseId={poseId} />
      <Figure poseId={poseId} />
    </motion.svg>
  );
}
