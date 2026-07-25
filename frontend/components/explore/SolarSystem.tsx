"use client";
import { motion } from "framer-motion";

interface Props { highlightPlanet?: string }

// Orbit radii are sized to fit inside the animation stage's shorter (height)
// dimension — the stage is ~288-320px tall, so anything wider than ~130px
// would clip its top/bottom against the panel's rounded overflow-hidden edge.
const PLANETS = [
  { name: "Mercury", r: 28, size: 8, color: "#a8a29e", surface: "radial-gradient(circle at 30% 28%, #f5f5f4 0 8%, #a8a29e 35%, #57534e 100%)", period: 4, label: "Mercury - closest to the Sun!" },
  { name: "Venus", r: 39, size: 11, color: "#f59e0b", surface: "repeating-linear-gradient(165deg, #fde68a 0 3px, #f59e0b 4px 6px, #b45309 7px 8px)", period: 7, label: "Venus - the hottest planet!" },
  { name: "Earth", r: 51, size: 12, color: "#38bdf8", surface: "radial-gradient(ellipse at 32% 35%, #4ade80 0 13%, transparent 14%), radial-gradient(ellipse at 68% 64%, #22c55e 0 12%, transparent 13%), radial-gradient(circle at 35% 30%, #7dd3fc, #0284c7 62%, #075985)", period: 10, label: "Earth - our home!" },
  { name: "Mars", r: 65, size: 10, color: "#ef4444", surface: "radial-gradient(circle at 68% 28%, #7f1d1d 0 8%, transparent 9%), radial-gradient(circle at 30% 30%, #fdba74, #dc2626 58%, #7f1d1d)", period: 15, label: "Mars - the red planet!" },
  { name: "Jupiter", r: 83, size: 18, color: "#d6a56c", surface: "repeating-linear-gradient(180deg, #f5deb3 0 3px, #b77942 4px 6px, #f3cc9a 7px 10px)", period: 25, label: "Jupiter - the giant!" },
  { name: "Saturn", r: 104, size: 16, color: "#fde68a", surface: "repeating-linear-gradient(180deg, #fef3c7 0 3px, #d6b968 4px 6px)", period: 35, label: "Saturn - the ringed planet!" },
  { name: "Uranus", r: 122, size: 13, color: "#67e8f9", surface: "radial-gradient(circle at 32% 28%, #cffafe, #67e8f9 55%, #0891b2)", period: 48, label: "Uranus - an ice giant!" },
  { name: "Neptune", r: 138, size: 13, color: "#3b82f6", surface: "repeating-linear-gradient(170deg, #60a5fa 0 4px, #2563eb 5px 8px, #1e3a8a 9px 11px)", period: 60, label: "Neptune - the farthest planet!" },
];

export function SolarSystem({ highlightPlanet }: Props) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Star field */}
      {Array.from({ length: 60 }, (_, i) => (
        <motion.div key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: Math.random() > 0.8 ? 2 : 1,
            height: Math.random() > 0.8 ? 2 : 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 3 }}
        />
      ))}

      {/* Sun */}
      <motion.div
        className="absolute rounded-full z-10"
        style={{ width: 48, height: 48, background: "radial-gradient(circle at 35% 35%, #fff7a0, #ffcc00, #ff8800)", boxShadow: "0 0 40px 16px #ffcc0060, 0 0 80px 32px #ff880030" }}
        animate={{ scale: [1, 1.06, 1], boxShadow: ["0 0 40px 16px #ffcc0060","0 0 60px 24px #ffcc0090","0 0 40px 16px #ffcc0060"] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Orbits + Planets */}
      {PLANETS.map((p) => {
        const isHighlighted = highlightPlanet?.toLowerCase() === p.name.toLowerCase();
        return (
          <div key={p.name} className="absolute" style={{ width: p.r * 2, height: p.r * 2, left: `calc(50% - ${p.r}px)`, top: `calc(50% - ${p.r}px)` }}>
            {/* Orbit ring */}
            <div className="absolute inset-0 rounded-full border border-white/10" />

            {/* Planet */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                top: 0,
                left: "50%",
                marginLeft: -p.size / 2,
                background: p.surface,
                boxShadow: isHighlighted ? `0 0 20px 8px ${p.color}` : `0 0 4px 2px ${p.color}50`,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: p.period, repeat: Infinity, ease: "linear" }}
              transformTemplate={({ rotate }) => `rotate(${rotate}) translateY(${-p.r}px) rotate(-${rotate})`}
            >
              {/* Saturn rings */}
              {p.name === "Saturn" && (
                <div className="absolute" style={{ width: p.size * 2.8, height: p.size * 0.6, background: "rgba(228,209,145,0.35)", borderRadius: "50%", top: "50%", left: "50%", transform: "translate(-50%,-50%) rotateX(70deg)", border: "2px solid rgba(228,209,145,0.5)" }} />
              )}
              {/* Earth moon */}
              {p.name === "Earth" && (
                <motion.div
                  className="absolute rounded-full bg-gray-300"
                  style={{ width: 4, height: 4, top: -12, left: "50%", marginLeft: -2 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.7, repeat: Infinity, ease: "linear" }}
                  transformTemplate={({ rotate }) => `rotate(${rotate}) translateY(-12px) rotate(-${rotate})`}
                />
              )}
            </motion.div>

            {/* Highlight label */}
            {isHighlighted && (
              <motion.div
                className="absolute text-xs text-white font-semibold bg-black/70 rounded-full px-2 py-1 whitespace-nowrap z-30"
                style={{ top: -32, left: "50%", transform: "translateX(-50%)" }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {p.label}
              </motion.div>
            )}
          </div>
        );
      })}

      {/* Clear planet icons remain visible while the narrated planet is highlighted. */}
      <div className="absolute inset-x-2 bottom-2 z-40 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/55 p-2 backdrop-blur-md" aria-label="Eight planets">
        {PLANETS.map((planet) => {
          const active = highlightPlanet?.toLowerCase() === planet.name.toLowerCase();
          return <div key={planet.name} className={`flex min-w-14 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition ${active ? "bg-white/20 ring-2 ring-amber-300" : "bg-white/[.04]"}`}>
            <div className="relative flex h-8 w-10 items-center justify-center">
              {planet.name === "Saturn" && <span className="absolute h-3 w-10 rotate-[-12deg] rounded-[50%] border-2 border-amber-200/70" />}
              <span className="relative h-7 w-7 rounded-full border border-white/30 shadow-md" style={{ background: planet.surface, boxShadow: active ? `0 0 14px ${planet.color}` : undefined }} />
            </div>
            <span className={`text-[9px] font-bold ${active ? "text-amber-200" : "text-white/70"}`}>{planet.name}</span>
          </div>;
        })}
      </div>
    </div>
  );
}
