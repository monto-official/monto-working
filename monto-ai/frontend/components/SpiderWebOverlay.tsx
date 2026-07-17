"use client";
/**
 * SpiderWebOverlay — Premium procedural SVG spider web system
 * Inspired by Spider-Man movie UI. No PNG images, pure SVG + CSS.
 * GPU-friendly: transform + opacity only. 60 FPS.
 */
import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  isListening: boolean;
  isSpeaking:  boolean;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Strand {
  id:     number;
  d:      string;   // SVG path data
  corner: "tl" | "tr" | "bl" | "br";
  delay:  number;
  dur:    number;
  opacity: number;
}

interface Particle {
  id:       number;
  strandId: number;
  offset:   number; // 0–1 along path
  speed:    number;
  size:     number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rand  = (min: number, max: number) => min + Math.random() * (max - min);
const randI = (min: number, max: number) => Math.floor(rand(min, max));

/** Build a realistic web fan from a corner */
function buildCornerWeb(
  corner: "tl" | "tr" | "bl" | "br",
  W: number,
  H: number,
  spokeCount: number,
  ringCount: number,
): string[] {
  const ox = corner === "tr" || corner === "br" ? W : 0;
  const oy = corner === "bl" || corner === "br" ? H : 0;

  // Angle range: 90° fan from corner
  const baseAngle =
    corner === "tl" ? 0
    : corner === "tr" ? 90
    : corner === "bl" ? 270
    : 180;

  const maxReach = Math.min(W, H) * 0.48;

  // Spokes
  const spokes: [number, number][] = Array.from({ length: spokeCount }, (_, i) => {
    const angle = ((baseAngle + (i / (spokeCount - 1)) * 90) * Math.PI) / 180;
    // Vary length slightly per spoke for organic feel
    const len = maxReach * rand(0.82, 1.0);
    return [ox + Math.cos(angle) * len, oy + Math.sin(angle) * len];
  });

  const paths: string[] = [];

  // Spoke paths
  spokes.forEach(([x, y]) => {
    paths.push(`M${ox.toFixed(1)} ${oy.toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}`);
  });

  // Concentric rings — slightly irregular for realism
  for (let r = 1; r <= ringCount; r++) {
    const t = r / ringCount;
    const pts = spokes.map(([x, y]) => {
      const dx = x - ox; const dy = y - oy;
      // Jitter each ring point slightly
      const jitter = rand(-4, 4);
      return [ox + dx * t + jitter, oy + dy * t + jitter] as [number, number];
    });

    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      // Quadratic bezier for natural curve
      const cpx = (pts[i-1][0] + pts[i][0]) / 2 + rand(-6, 6);
      const cpy = (pts[i-1][1] + pts[i][1]) / 2 + rand(-6, 6);
      d += ` Q${cpx.toFixed(1)} ${cpy.toFixed(1)} ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
    }
    paths.push(d);
  }

  return paths;
}

/** Build initial strand set from all 4 corners */
function buildInitialStrands(W: number, H: number): Strand[] {
  const strands: Strand[] = [];
  let id = 0;
  (["tl","tr","bl","br"] as const).forEach(corner => {
    const paths = buildCornerWeb(corner, W, H, 7, 5);
    paths.forEach(d => {
      strands.push({
        id:      id++,
        d,
        corner,
        delay:   rand(0, 4),
        dur:     rand(7, 14),
        opacity: rand(0.13, 0.22),
      });
    });
  });
  return strands;
}

/** Build a single new silk strand from a random corner */
function buildNewStrand(W: number, H: number, id: number): Strand {
  const corners = ["tl","tr","bl","br"] as const;
  const corner  = corners[randI(0, 4)];
  const ox = corner === "tr" || corner === "br" ? W : 0;
  const oy = corner === "bl" || corner === "br" ? H : 0;
  const baseAngle =
    corner === "tl" ? 0 : corner === "tr" ? 90 : corner === "bl" ? 270 : 180;

  const angle1 = ((baseAngle + rand(5, 40)) * Math.PI) / 180;
  const angle2 = ((baseAngle + rand(50, 85)) * Math.PI) / 180;
  const len    = Math.min(W, H) * rand(0.28, 0.46);

  const x1 = ox + Math.cos(angle1) * len;
  const y1 = oy + Math.sin(angle1) * len;
  const x2 = ox + Math.cos(angle2) * len * rand(0.5, 0.9);
  const y2 = oy + Math.sin(angle2) * len * rand(0.5, 0.9);
  const cpx = (x1 + x2) / 2 + rand(-20, 20);
  const cpy = (y1 + y2) / 2 + rand(-20, 20);

  return {
    id,
    d:       `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cpx.toFixed(1)} ${cpy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    corner,
    delay:   0,
    dur:     rand(8, 16),
    opacity: rand(0.10, 0.18),
  };
}

// ─── Sway keyframes per corner ────────────────────────────────────────────────
const SWAY_ORIGINS: Record<string, string> = {
  tl: "0% 0%", tr: "100% 0%", bl: "0% 100%", br: "100% 100%",
};

// ─── Cute Spider component ────────────────────────────────────────────────────
function CuteSpider({
  x, y, hidden, blinkOpen,
}: { x: number; y: number; hidden: boolean; blinkOpen: boolean }) {
  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{
        transition: "transform 2s cubic-bezier(0.4,0,0.2,1), opacity 1s ease",
        opacity: hidden ? 0 : 1,
      }}
    >
      {/* Silk thread up */}
      <line x1="0" y1="-80" x2="0" y2="-14"
        stroke="rgba(255,255,255,0.4)" strokeWidth="0.8"/>

      {/* Legs left */}
      <line x1="-3" y1="-2"  x2="-12" y2="-8"  stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.85"/>
      <line x1="-3" y1="0"   x2="-13" y2="0"   stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.85"/>
      <line x1="-3" y1="3"   x2="-11" y2="8"   stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.85"/>
      <line x1="-2" y1="5"   x2="-9"  y2="12"  stroke="white" strokeWidth="1"   strokeLinecap="round" opacity="0.7"/>
      {/* Legs right */}
      <line x1="3"  y1="-2"  x2="12"  y2="-8"  stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.85"/>
      <line x1="3"  y1="0"   x2="13"  y2="0"   stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.85"/>
      <line x1="3"  y1="3"   x2="11"  y2="8"   stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.85"/>
      <line x1="2"  y1="5"   x2="9"   y2="12"  stroke="white" strokeWidth="1"   strokeLinecap="round" opacity="0.7"/>

      {/* Body */}
      <ellipse cx="0" cy="5" rx="5" ry="6.5"
        fill="#0d0d1a" stroke="rgba(220,235,255,0.7)" strokeWidth="0.7"/>
      {/* Abdomen shimmer */}
      <ellipse cx="0" cy="6" rx="3" ry="4"
        fill="rgba(100,120,255,0.12)"/>

      {/* Head */}
      <circle cx="0" cy="-5" r="5.5"
        fill="#0d0d1a" stroke="rgba(220,235,255,0.7)" strokeWidth="0.7"/>

      {/* Eyes */}
      <circle cx="-2.2" cy="-5.5" r={blinkOpen ? 2 : 0.3}
        fill="white" style={{ transition: "r 0.08s ease" }}/>
      <circle cx="2.2"  cy="-5.5" r={blinkOpen ? 2 : 0.3}
        fill="white" style={{ transition: "r 0.08s ease" }}/>
      {/* Pupils */}
      {blinkOpen && <>
        <circle cx="-1.8" cy="-5.5" r="1.1" fill="#5b6ff7"/>
        <circle cx="2.6"  cy="-5.5" r="1.1" fill="#5b6ff7"/>
        {/* Shine */}
        <circle cx="-1.3" cy="-6"   r="0.45" fill="white"/>
        <circle cx="3.1"  cy="-6"   r="0.45" fill="white"/>
      </>}

      {/* Smile */}
      <path d="M-2.5 -2.5 Q0 -0.5 2.5 -2.5"
        stroke="rgba(220,235,255,0.6)" strokeWidth="0.7" fill="none" strokeLinecap="round"/>
    </g>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────
export function SpiderWebOverlay({ isListening, isSpeaking }: Props) {
  const [dims,     setDims]     = useState({ W: 390, H: 844 });
  const [strands,  setStrands]  = useState<Strand[]>([]);
  const [nextId,   setNextId]   = useState(0);
  const [spiderPos, setSpiderPos] = useState({ x: 40, y: 120 });
  const [spiderHidden, setSpiderHidden] = useState(false);
  const [blinkOpen, setBlinkOpen] = useState(true);
  const strandIdRef = useRef(0);
  const cycleRef    = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Init on mount — measure actual screen size
  useEffect(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    setDims({ W, H });
    const initial = buildInitialStrands(W, H);
    strandIdRef.current = initial.length;
    setStrands(initial);
    setNextId(initial.length);
  }, []);

  // Grow new silk strands every 12–18s
  useEffect(() => {
    if (!dims.W) return;
    const schedule = () => {
      const t = setTimeout(() => {
        const id = strandIdRef.current++;
        setStrands(prev => {
          // Keep max 80 strands to avoid memory growth
          const next = [...prev, buildNewStrand(dims.W, dims.H, id)];
          return next.length > 80 ? next.slice(next.length - 80) : next;
        });
        schedule();
      }, rand(12000, 18000));
      cycleRef.current.push(t);
    };
    schedule();
    return () => cycleRef.current.forEach(clearTimeout);
  }, [dims]);

  // Random spider wander across the web corners
  const wander = useCallback(() => {
    const corners = [
      { x: rand(10, 60),            y: rand(10, 80) },
      { x: dims.W - rand(10, 60),   y: rand(10, 80) },
      { x: rand(10, 60),            y: dims.H - rand(10, 80) },
      { x: dims.W - rand(10, 60),   y: dims.H - rand(10, 80) },
    ];
    const pos = corners[randI(0, 4)];
    setSpiderPos(pos);
  }, [dims]);

  useEffect(() => {
    const t = setInterval(wander, rand(6000, 12000));
    return () => clearInterval(t);
  }, [wander]);

  // Blink randomly
  useEffect(() => {
    const blink = () => {
      setBlinkOpen(false);
      setTimeout(() => setBlinkOpen(true), 120);
      setTimeout(blink, rand(2500, 6000));
    };
    const t = setTimeout(blink, rand(2000, 4000));
    return () => clearTimeout(t);
  }, []);

  // React to listening / speaking
  useEffect(() => {
    if (isListening) {
      setSpiderHidden(true);
    } else if (!isSpeaking) {
      setTimeout(() => {
        setSpiderHidden(false);
        wander();
      }, 800);
    }
  }, [isListening, isSpeaking, wander]);

  const { W, H } = dims;

  // Group strands by corner for transform-origin sway
  const byCorner = strands.reduce((acc, s) => {
    (acc[s.corner] = acc[s.corner] || []).push(s);
    return acc;
  }, {} as Record<string, Strand[]>);

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
      aria-hidden
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          {/* Glow filter */}
          <filter id="web-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          {/* Particle glow */}
          <filter id="particle-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          {/* Radial mask — keeps center 70% clean */}
          <radialGradient id="web-mask-grad" cx="50%" cy="50%" r="35%" fx="50%" fy="50%">
            <stop offset="0%"   stopColor="black" stopOpacity="1"/>
            <stop offset="70%"  stopColor="black" stopOpacity="1"/>
            <stop offset="100%" stopColor="black" stopOpacity="0"/>
          </radialGradient>
          <mask id="web-mask">
            <rect width="100%" height="100%" fill="white"/>
            <rect width="100%" height="100%" fill="url(#web-mask-grad)"/>
          </mask>
        </defs>

        {/* Web strands grouped by corner with sway */}
        <g mask="url(#web-mask)" filter="url(#web-glow)">
          {(["tl","tr","bl","br"] as const).map(corner => (
            <g
              key={corner}
              style={{
                transformOrigin: SWAY_ORIGINS[corner],
                animation: `web-sway-${corner} ${8 + (corner === "tr" ? 1 : corner === "bl" ? -1 : corner === "br" ? 0.5 : 0)}s ease-in-out infinite`,
                willChange: "transform",
              }}
            >
              {(byCorner[corner] || []).map(s => (
                <path
                  key={s.id}
                  d={s.d}
                  stroke={`rgba(220,235,255,${s.opacity})`}
                  strokeWidth="0.7"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    animation: `strand-oscillate-${s.id % 6} ${s.dur}s ease-in-out ${s.delay}s infinite`,
                    willChange: "transform, opacity",
                  }}
                />
              ))}
            </g>
          ))}

          {/* Travelling particles along strands */}
          {strands.filter((_, i) => i % 8 === 0).slice(0, 6).map(s => (
            <circle
              key={`p${s.id}`}
              r="1.8"
              fill="#DCEBFF"
              filter="url(#particle-glow)"
              opacity="0.7"
              style={{
                offsetPath: `path("${s.d}")`,
                offsetDistance: "0%",
                animation: `travel-particle ${rand(4, 8).toFixed(1)}s linear ${rand(0, 3).toFixed(1)}s infinite`,
                willChange: "offset-distance",
              } as React.CSSProperties}
            />
          ))}
        </g>

        {/* Spider */}
        <g
          style={{
            transform: `translate(${spiderPos.x}px, ${spiderPos.y}px)`,
            transition: `transform ${rand(3, 5).toFixed(1)}s cubic-bezier(0.4,0,0.2,1)`,
            opacity: spiderHidden ? 0 : 1,
            willChange: "transform, opacity",
          }}
        >
          <CuteSpider x={0} y={0} hidden={false} blinkOpen={blinkOpen} />
        </g>
      </svg>
    </div>
  );
}
