"use client";
/**
 * ArmHand — Reusable premium arm+hand component for Nani & Babu
 * Pixar/Disney-style with:
 *  - Rounded cylindrical upper arm + forearm
 *  - Elbow joint sphere
 *  - Chubby cartoon hand with 5 rounded fingers
 *  - Full animation poses: wave, point, clap, explain, thumbsUp, count, etc.
 */
import { motion } from "framer-motion";

export type ArmPose =
  | "idle"
  | "wave"
  | "pointRight"
  | "pointLeft"
  | "pointUp"
  | "clap"
  | "explain"
  | "holdBook"
  | "thumbsUp"
  | "celebrate"
  | "thinking"
  | "count1" | "count2" | "count3"
  | "holdPlanet"
  | "drawInAir";

interface Props {
  side:         "left" | "right";
  pose:         ArmPose;
  skinColor:    string;
  sleeveColor:  string;
  size?:        number;        // scale factor (default 1)
  animate?:     boolean;
}

// ── Pose data ─────────────────────────────────────────────────────────────────
// Each pose defines: shoulderAngle (rotation of whole arm from shoulder),
// elbowBend (how much forearm bends relative to upper arm, 0=straight,1=fully bent),
// wristAngle, fingerSplay
interface PoseData {
  shoulderAngle: number;   // degrees, 0 = hanging down
  elbowBend:     number;   // 0–1
  wristAngle:    number;   // degrees
  fingers: {
    thumb: number;   // 0=closed 1=open
    index: number;
    middle: number;
    ring: number;
    pinky: number;
  };
}

const POSES: Record<ArmPose, (side: "left"|"right") => PoseData> = {
  idle: () => ({
    shoulderAngle: 12, elbowBend: 0.08, wristAngle: 0,
    fingers: { thumb:0.6, index:0.6, middle:0.6, ring:0.6, pinky:0.6 }
  }),
  wave: (s) => ({
    shoulderAngle: s === "right" ? -75 : 75, elbowBend: 0.55, wristAngle: s === "right" ? 20 : -20,
    fingers: { thumb:1, index:1, middle:1, ring:1, pinky:1 }
  }),
  pointRight: () => ({
    shoulderAngle: -45, elbowBend: 0.1, wristAngle: 0,
    fingers: { thumb:0.3, index:1, middle:0, ring:0, pinky:0 }
  }),
  pointLeft: () => ({
    shoulderAngle: 45, elbowBend: 0.1, wristAngle: 0,
    fingers: { thumb:0.3, index:1, middle:0, ring:0, pinky:0 }
  }),
  pointUp: () => ({
    shoulderAngle: -10, elbowBend: 0.0, wristAngle: -70,
    fingers: { thumb:0.3, index:1, middle:0, ring:0, pinky:0 }
  }),
  clap: (s) => ({
    shoulderAngle: s === "right" ? -20 : 20, elbowBend: 0.7, wristAngle: s === "right" ? -10 : 10,
    fingers: { thumb:1, index:1, middle:1, ring:1, pinky:1 }
  }),
  explain: (s) => ({
    shoulderAngle: s === "right" ? -35 : 35, elbowBend: 0.55, wristAngle: s === "right" ? 15 : -15,
    fingers: { thumb:0.8, index:0.9, middle:0.8, ring:0.7, pinky:0.7 }
  }),
  holdBook: (s) => ({
    shoulderAngle: s === "right" ? -25 : 25, elbowBend: 0.75, wristAngle: s === "right" ? 0 : 0,
    fingers: { thumb:0.5, index:0.4, middle:0.4, ring:0.4, pinky:0.4 }
  }),
  thumbsUp: (s) => ({
    shoulderAngle: s === "right" ? -50 : 50, elbowBend: 0.4, wristAngle: s === "right" ? 10 : -10,
    fingers: { thumb:1, index:0, middle:0, ring:0, pinky:0 }
  }),
  celebrate: (s) => ({
    shoulderAngle: s === "right" ? -90 : 90, elbowBend: 0.2, wristAngle: s === "right" ? 20 : -20,
    fingers: { thumb:1, index:1, middle:1, ring:1, pinky:1 }
  }),
  thinking: (s) => ({
    shoulderAngle: s === "right" ? -10 : 10, elbowBend: 0.9, wristAngle: s === "right" ? 30 : -30,
    fingers: { thumb:0.6, index:0.8, middle:0.5, ring:0.4, pinky:0.4 }
  }),
  count1: () => ({
    shoulderAngle: -30, elbowBend: 0.3, wristAngle: 0,
    fingers: { thumb:0.2, index:1, middle:0, ring:0, pinky:0 }
  }),
  count2: () => ({
    shoulderAngle: -30, elbowBend: 0.3, wristAngle: 0,
    fingers: { thumb:0.2, index:1, middle:1, ring:0, pinky:0 }
  }),
  count3: () => ({
    shoulderAngle: -30, elbowBend: 0.3, wristAngle: 0,
    fingers: { thumb:0.2, index:1, middle:1, ring:1, pinky:0 }
  }),
  holdPlanet: (s) => ({
    shoulderAngle: s === "right" ? -55 : 55, elbowBend: 0.6, wristAngle: 0,
    fingers: { thumb:0.7, index:0.5, middle:0.5, ring:0.5, pinky:0.5 }
  }),
  drawInAir: (s) => ({
    shoulderAngle: s === "right" ? -40 : 40, elbowBend: 0.3, wristAngle: s === "right" ? 20 : -20,
    fingers: { thumb:0.3, index:1, middle:0.1, ring:0, pinky:0 }
  }),
};

// ── Geometry helpers ──────────────────────────────────────────────────────────
function computeArmGeometry(pose: PoseData, side: "left"|"right", scale: number) {
  const dir   = side === "right" ? 1 : -1;
  const sa    = pose.shoulderAngle * dir; // shoulder rotation in degrees
  const saRad = (sa * Math.PI) / 180;

  // Upper arm length & width
  const UAL = 48 * scale;
  const UAW = 14 * scale;
  // Forearm length & width
  const FAL = 42 * scale;
  const FAW = 12 * scale;
  // Elbow sphere
  const EW  = 9 * scale;
  // Hand
  const HW  = 22 * scale;
  const HH  = 20 * scale;

  // Shoulder anchor — where arm meets torso
  const sx = (side === "right" ? 120 : 80) * scale;
  const sy = 130 * scale;

  // Elbow position (end of upper arm)
  const elbowBendAngle = pose.elbowBend * 140; // max 140° bend
  const ex = sx + Math.sin(saRad) * UAL;
  const ey = sy + Math.cos(saRad) * UAL;

  // Forearm direction: continues from elbow with additional bend
  const faAngle    = saRad + (elbowBendAngle * dir * Math.PI) / 180;
  const wristAngle = pose.wristAngle * dir;
  const wx = ex + Math.sin(faAngle) * FAL;
  const wy = ey + Math.cos(faAngle) * FAL;

  return { sx, sy, ex, ey, wx, wy, UAW, FAW, EW, HW, HH, saRad, faAngle, wristAngle };
}

// ── Chubby hand with 5 fingers ────────────────────────────────────────────────
function Hand({
  cx, cy, angle, scale, skinColor, fingers, side,
}: {
  cx: number; cy: number; angle: number; scale: number;
  skinColor: string;
  fingers: PoseData["fingers"];
  side: "left"|"right";
}) {
  const dir = side === "right" ? 1 : -1;
  const fw = 22 * scale;
  const fh = 20 * scale;
  const palmW = fw * 0.64;
  const palmH = fh * 0.52;

  const FINGER_DEFS = [
    { name: "thumb",  baseX: -palmW * 0.54 * dir, baseY: -palmH * 0.08, len: 14 * scale, w: 8 * scale, angle: dir * -58, open: fingers.thumb },
    { name: "index",  baseX: -palmW * 0.26 * dir, baseY: -palmH * 0.62, len: 16 * scale, w: 6.5 * scale, angle: dir * -8, open: fingers.index },
    { name: "middle", baseX:  0 * dir, baseY: -palmH * 0.72, len: 18 * scale, w: 7 * scale, angle: 0, open: fingers.middle },
    { name: "ring",   baseX:  palmW * 0.22 * dir, baseY: -palmH * 0.62, len: 16 * scale, w: 6.4 * scale, angle: dir * 7, open: fingers.ring },
    { name: "pinky",  baseX:  palmW * 0.46 * dir, baseY: -palmH * 0.48, len: 13 * scale, w: 5.2 * scale, angle: dir * 18, open: fingers.pinky },
  ];

  const palmPath = `M ${-palmW * 0.55 * dir} 0
    Q ${-palmW * 0.48 * dir} ${-palmH * 0.82} ${-palmW * 0.22 * dir} ${-palmH * 1.02}
    Q 0 ${-palmH * 1.18} ${palmW * 0.22 * dir} ${-palmH * 1.02}
    Q ${palmW * 0.48 * dir} ${-palmH * 0.82} ${palmW * 0.55 * dir} 0
    Q ${palmW * 0.46 * dir} ${palmH * 0.72} ${palmW * 0.18 * dir} ${palmH * 0.98}
    L ${-palmW * 0.18 * dir} ${palmH * 0.98}
    Q ${-palmW * 0.46 * dir} ${palmH * 0.72} ${-palmW * 0.55 * dir} 0 Z`;

  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${angle})`}>
      <path d={palmPath}
        fill={skinColor} stroke="rgba(0,0,0,0.12)" strokeWidth="0.85" />
      <path d={`M ${-palmW * 0.34 * dir} ${-palmH * 0.18} Q 0 ${-palmH * 0.4} ${palmW * 0.34 * dir} ${-palmH * 0.18}`}
        stroke="rgba(0,0,0,0.08)" strokeWidth="0.75" fill="none" />
      <path d={`M ${-palmW * 0.22 * dir} ${palmH * 0.24} Q 0 ${palmH * 0.42} ${palmW * 0.22 * dir} ${palmH * 0.24}`}
        stroke="rgba(255,255,255,0.18)" strokeWidth="0.85" fill="none" opacity="0.9" />
      <ellipse cx={-palmW * 0.08 * dir} cy={palmH * 0.14} rx={fw * 0.16} ry={fw * 0.08}
        fill="rgba(255,255,255,0.12)" />

      {FINGER_DEFS.map(f => {
        const curl = (1 - f.open) * 64;
        const proximal = f.len * 0.44;
        const middle = f.len * 0.33;
        const distal = f.len * 0.23;
        const tipRadius = f.w * 0.52;

        return (
          <g key={f.name} transform={`translate(${f.baseX}, ${f.baseY}) rotate(${f.angle})`}>
            <g transform={`rotate(${-curl * 0.34})`}>
              <rect x={-f.w * 0.44 / 2} y={-proximal} width={f.w * 0.44} height={proximal}
                rx={f.w * 0.36} fill={skinColor} stroke="rgba(0,0,0,0.1)" strokeWidth="0.55" />
              <ellipse cx={0} cy={0} rx={f.w * 0.45} ry={f.w * 0.38} fill={skinColor}
                stroke="rgba(0,0,0,0.08)" strokeWidth="0.45" />

              <g transform={`translate(0, ${-proximal}) rotate(${-curl * 0.28})`}>
                <rect x={-f.w * 0.4 / 2} y={-middle} width={f.w * 0.4} height={middle}
                  rx={f.w * 0.33} fill={skinColor} stroke="rgba(0,0,0,0.08)" strokeWidth="0.45" />
                <ellipse cx={0} cy={0} rx={f.w * 0.38} ry={f.w * 0.33} fill={skinColor}
                  stroke="rgba(0,0,0,0.07)" strokeWidth="0.45" />

                <g transform={`translate(0, ${-middle}) rotate(${-curl * 0.2})`}>
                  <rect x={-f.w * 0.34 / 2} y={-distal} width={f.w * 0.34} height={distal}
                    rx={f.w * 0.3} fill={skinColor} stroke="rgba(0,0,0,0.07)" strokeWidth="0.45" />
                  <ellipse cx={0} cy={-distal} rx={tipRadius} ry={tipRadius * 0.72}
                    fill={skinColor} />
                  {f.open > 0.35 && (
                    <ellipse cx={0} cy={-distal * 0.8} rx={f.w * 0.2} ry={f.w * 0.08}
                      fill="rgba(255,230,215,0.9)" stroke="rgba(220,180,160,0.3)" strokeWidth="0.35" />
                  )}
                </g>
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
}

// ── Main ArmHand component ────────────────────────────────────────────────────
export function ArmHand({ side, pose, skinColor, sleeveColor, size = 1, animate = true }: Props) {
  const poseData = POSES[pose](side);
  const g = computeArmGeometry(poseData, side, size);

  // Idle breathing sway
  const idleSway = side === "right"
    ? { rotate: [0, 2, 0, -1, 0], transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" } }
    : { rotate: [0, -2, 0, 1, 0], transition: { duration: 3.8, repeat: Infinity, ease: "easeInOut" } };

  return (
    <motion.g
      style={{ transformOrigin: `${g.sx}px ${g.sy}px` }}
      animate={animate ? idleSway : {}}
    >
      {/* ── Upper arm — rounded cylinder ── */}
      {/* Shadow/depth cylinder back */}
      <line
        x1={g.sx} y1={g.sy} x2={g.ex} y2={g.ey}
        stroke={sleeveColor}
        strokeWidth={g.UAW * 1.06}
        strokeLinecap="round"
        style={{ filter: "brightness(0.85)" }}
      />
      {/* Main upper arm */}
      <line x1={g.sx} y1={g.sy} x2={g.ex} y2={g.ey}
        stroke={sleeveColor} strokeWidth={g.UAW} strokeLinecap="round"/>
      {/* Highlight along upper arm */}
      <line
        x1={g.sx + Math.cos(g.saRad + Math.PI/2) * g.UAW * 0.22}
        y1={g.sy + Math.sin(g.saRad + Math.PI/2) * g.UAW * 0.22}
        x2={g.ex + Math.cos(g.saRad + Math.PI/2) * g.UAW * 0.18}
        y2={g.ey + Math.sin(g.saRad + Math.PI/2) * g.UAW * 0.18}
        stroke="rgba(255,255,255,0.22)" strokeWidth={g.UAW * 0.28} strokeLinecap="round"
      />

      {/* ── Shoulder joint sphere ── */}
      <circle cx={g.sx} cy={g.sy} r={g.UAW * 0.58} fill={sleeveColor}
        stroke="rgba(0,0,0,0.1)" strokeWidth="0.8"/>
      <ellipse cx={g.sx - g.UAW * 0.14} cy={g.sy - g.UAW * 0.14}
        rx={g.UAW * 0.22} ry={g.UAW * 0.18} fill="rgba(255,255,255,0.2)"/>

      {/* ── Elbow joint sphere ── */}
      <circle cx={g.ex} cy={g.ey} r={g.EW} fill={skinColor}
        stroke="rgba(0,0,0,0.12)" strokeWidth="0.8"/>
      <ellipse cx={g.ex - g.EW * 0.2} cy={g.ey - g.EW * 0.2}
        rx={g.EW * 0.38} ry={g.EW * 0.3} fill="rgba(255,255,255,0.22)"/>

      {/* ── Forearm — rounded cylinder ── */}
      <line x1={g.ex} y1={g.ey} x2={g.wx} y2={g.wy}
        stroke={skinColor} strokeWidth={g.FAW * 1.05} strokeLinecap="round"
        style={{ filter: "brightness(0.9)" }}/>
      <line x1={g.ex} y1={g.ey} x2={g.wx} y2={g.wy}
        stroke={skinColor} strokeWidth={g.FAW} strokeLinecap="round"/>
      {/* Forearm highlight */}
      <line
        x1={g.ex + Math.cos(g.faAngle + Math.PI/2) * g.FAW * 0.2}
        y1={g.ey + Math.sin(g.faAngle + Math.PI/2) * g.FAW * 0.2}
        x2={g.wx + Math.cos(g.faAngle + Math.PI/2) * g.FAW * 0.15}
        y2={g.wy + Math.sin(g.faAngle + Math.PI/2) * g.FAW * 0.15}
        stroke="rgba(255,255,255,0.18)" strokeWidth={g.FAW * 0.25} strokeLinecap="round"
      />

      {/* ── Wrist sphere ── */}
      <circle cx={g.wx} cy={g.wy} r={g.FAW * 0.52} fill={skinColor}
        stroke="rgba(0,0,0,0.1)" strokeWidth="0.6"/>

      {/* ── Hand ── */}
      <Hand
        cx={g.wx} cy={g.wy}
        angle={g.wristAngle + (Math.atan2(g.wy - g.ey, g.wx - g.ex) * 180 / Math.PI) + 90}
        scale={size}
        skinColor={skinColor}
        fingers={poseData.fingers}
        side={side}
      />
    </motion.g>
  );
}
