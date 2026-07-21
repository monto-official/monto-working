"use client";
import { motion } from "framer-motion";

interface Props { highlightPlanet?: string }

const PLANETS = [
  { name: "Mercury", r: 52,  size: 6,  color: "#b5b5b5", period: 4,   label: "Mercury — closest to the Sun! ☿" },
  { name: "Venus",   r: 72,  size: 9,  color: "#e8c97a", period: 7,   label: "Venus — super hot! ♀" },
  { name: "Earth",   r: 96,  size: 10, color: "#4fa3e0", period: 10,  label: "Earth — our home! 🌍" },
  { name: "Mars",    r: 122, size: 8,  color: "#c1440e", period: 15,  label: "Mars — the red planet! ♂" },
  { name: "Jupiter", r: 156, size: 18, color: "#c88b3a", period: 25,  label: "Jupiter — the giant! ♃" },
  { name: "Saturn",  r: 196, size: 16, color: "#e4d191", period: 35,  label: "Saturn — with rings! ♄" },
  { name: "Uranus",  r: 232, size: 13, color: "#7de8e8", period: 48,  label: "Uranus — ice giant! ⛢" },
  { name: "Neptune", r: 262, size: 12, color: "#3f54ba", period: 60,  label: "Neptune — the farthest! ♆" },
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
                background: p.color,
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
    </div>
  );
}
