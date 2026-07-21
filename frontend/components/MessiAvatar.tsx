"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Emotion } from "@/types";

interface MessiAvatarProps {
  emotion: Emotion;
  size?: number;
}

// ── Geometry helper for the soccer-ball pentagon pattern ──────────────────
function pentagonPoints(cx: number, cy: number, r: number, rotationDeg = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = ((rotationDeg + i * 72) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function SoccerBall({ cx, cy, r, uid }: { cx: number; cy: number; r: number; uid: string }) {
  return (
    <g>
      <defs>
        <clipPath id={`ballClip-${uid}`}><circle cx={cx} cy={cy} r={r} /></clipPath>
        <radialGradient id={`ballG-${uid}`} cx="35%" cy="28%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#EDEDED" />
          <stop offset="100%" stopColor="#C9C9C9" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#ballClip-${uid})`}>
        <circle cx={cx} cy={cy} r={r} fill={`url(#ballG-${uid})`} />
        <polygon points={pentagonPoints(cx, cy, r * 0.36)} fill="#1A1A1A" />
        {Array.from({ length: 5 }).map((_, i) => {
          const angle = ((-90 + i * 72) * Math.PI) / 180;
          const ox = cx + r * 0.78 * Math.cos(angle);
          const oy = cy + r * 0.78 * Math.sin(angle);
          const ix = cx + r * 0.36 * Math.cos(angle);
          const iy = cy + r * 0.36 * Math.sin(angle);
          return (
            <g key={i}>
              <line x1={ix} y1={iy} x2={ox} y2={oy} stroke="#1A1A1A" strokeWidth={Math.max(1, r * 0.055)} strokeLinecap="round" />
              <polygon points={pentagonPoints(ox, oy, r * 0.27, -90 + i * 72)} fill="#1A1A1A" opacity={0.92} />
            </g>
          );
        })}
        <ellipse cx={cx - r * 0.32} cy={cy - r * 0.36} rx={r * 0.38} ry={r * 0.22} fill="white" opacity={0.4} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#00000025" strokeWidth={0.8} />
    </g>
  );
}

export function MessiAvatar({ emotion, size = 320 }: MessiAvatarProps) {
  const isTalking  = emotion === "talking";
  const isHappy    = emotion === "happy" || emotion === "excited";
  const isSad      = emotion === "sad";
  const isThinking = emotion === "thinking";
  const isSurprise = emotion === "surprised";
  const isExcited  = emotion === "excited";

  // ── Mouth shapes ─────────────────────────────────────────────────────────
  const mouthPath: Record<Emotion, string> = {
    happy:     "M 84 106 Q 100 118 116 106",
    excited:   "M 82 104 Q 100 120 118 104",
    sad:       "M 86 112 Q 100 104 114 112",
    thinking:  "M 88 109 Q 100 109 112 109",
    surprised: "M 92 106 Q 100 114 108 106",
    neutral:   "M 87 108 Q 100 112 113 108",
    talking:   "M 85 106 Q 100 118 115 106",
  };
  const mouthFill: Record<Emotion, string> = {
    happy: "", excited: "", sad: "", thinking: "", neutral: "",
    surprised: "M 92 106 Q 100 118 108 106 Q 100 110 92 106 Z",
    talking:   "M 85 106 Q 100 122 115 106 Q 100 112 85 106 Z",
  };

  // ── Eyes (round, expressive, with pupils) ────────────────────────────────
  const eyeScale: Record<Emotion, number> = {
    happy: 0.85, excited: 0.8, sad: 0.9, thinking: 0.9,
    surprised: 1.15, neutral: 1, talking: 1,
  };
  const browTilt: Record<Emotion, { l: number; r: number }> = {
    happy:     { l: -6,  r: 6  },
    excited:   { l: -10, r: 10 },
    sad:       { l: 8,   r: -8 },
    thinking:  { l: -4,  r: 10 },
    surprised: { l: -12, r: 12 },
    neutral:   { l: 0,   r: 0  },
    talking:   { l: -2,  r: 2  },
  };
  const brow = browTilt[emotion];

  // ── Arm keyframes (same skeleton as Spiderman for consistent motion) ────
  type ArmPt = { x1:number; y1:number; x2:number; y2:number; x3:number; y3:number };
  const leftArm: Record<Emotion, ArmPt> = {
    happy:     { x1:80,y1:124, x2:48,y2:104, x3:30,y3:82  },
    excited:   { x1:80,y1:124, x2:42,y2:94,  x3:22,y3:68  },
    sad:       { x1:80,y1:124, x2:62,y2:144, x3:50,y3:162 },
    thinking:  { x1:80,y1:124, x2:56,y2:130, x3:70,y3:108 },
    surprised: { x1:80,y1:124, x2:44,y2:96,  x3:24,y3:72  },
    neutral:   { x1:80,y1:124, x2:56,y2:116, x3:42,y3:104 },
    talking:   { x1:80,y1:124, x2:50,y2:106, x3:34,y3:90  },
  };
  const rightArm: Record<Emotion, ArmPt> = {
    happy:     { x1:120,y1:124, x2:152,y2:104, x3:170,y3:82  },
    excited:   { x1:120,y1:124, x2:158,y2:94,  x3:178,y3:68  },
    sad:       { x1:120,y1:124, x2:138,y2:144, x3:150,y3:162 },
    thinking:  { x1:120,y1:124, x2:144,y2:112, x3:152,y3:90  },
    surprised: { x1:120,y1:124, x2:156,y2:96,  x3:176,y3:72  },
    neutral:   { x1:120,y1:124, x2:144,y2:116, x3:158,y3:104 },
    talking:   { x1:120,y1:124, x2:150,y2:106, x3:166,y3:90  },
  };
  const la = leftArm[emotion];
  const ra = rightArm[emotion];

  return (
    <motion.div
      style={{ width: size, height: size * 1.15 }}
      className="relative flex items-center justify-center"
      animate={{ y: isSad ? [4,10,4] : [0,-10,0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg width={size} height={size*1.15} viewBox="0 0 200 230" fill="none">
        <defs>
          {/* Argentina sky-blue */}
          <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8FC7F2"/>
            <stop offset="55%" stopColor="#5CA9E0"/>
            <stop offset="100%" stopColor="#3A82BE"/>
          </linearGradient>
          <linearGradient id="whiteG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF"/>
            <stop offset="100%" stopColor="#E7EEF5"/>
          </linearGradient>
          <radialGradient id="skinG" cx="38%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#E8B48C"/>
            <stop offset="55%" stopColor="#D69A6C"/>
            <stop offset="100%" stopColor="#B87A4E"/>
          </radialGradient>
          <radialGradient id="hairG" cx="40%" cy="20%" r="70%">
            <stop offset="0%" stopColor="#3B2A1E"/>
            <stop offset="100%" stopColor="#1E140D"/>
          </radialGradient>
          <radialGradient id="shortsG" cx="40%" cy="20%" r="70%">
            <stop offset="0%" stopColor="#4A4A4A"/>
            <stop offset="100%" stopColor="#1C1C1C"/>
          </radialGradient>
          <radialGradient id="mShade" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="black" stopOpacity="0.2"/>
          </radialGradient>
          {/* Pitch backdrop */}
          <radialGradient id="pitchG" cx="50%" cy="38%" r="75%">
            <stop offset="0%" stopColor="#3FA34D"/>
            <stop offset="70%" stopColor="#2E8B42"/>
            <stop offset="100%" stopColor="#1F6B33"/>
          </radialGradient>
          <radialGradient id="floodlight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF6D0" stopOpacity="0.55"/>
            <stop offset="100%" stopColor="#FFF6D0" stopOpacity="0"/>
          </radialGradient>
          <clipPath id="torsoClip">
            <path d="M 78 118 Q 64 130 64 158 Q 72 178 100 180 Q 128 178 136 158 Q 136 130 122 118 Q 110 124 100 124 Q 90 124 78 118 Z"/>
          </clipPath>
        </defs>

        {/* ══════════ BACKGROUND — pitch + floodlights + big ball ══════════ */}
        <rect x="0" y="0" width="200" height="230" fill="url(#pitchG)" opacity="0.5"/>
        {/* Grass stripes */}
        {[0,1,2,3,4,5].map(i => (
          <rect key={i} x={i*34} y="0" width="17" height="230" fill="black" opacity="0.05"/>
        ))}
        {/* Floodlight glows */}
        <circle cx="20" cy="24" r="46" fill="url(#floodlight)"/>
        <circle cx="182" cy="30" r="42" fill="url(#floodlight)"/>
        {/* Distant goal net (top, faint) */}
        <g opacity="0.22" stroke="white" strokeWidth="0.8">
          <rect x="58" y="10" width="84" height="30" fill="none"/>
          {[0,1,2,3,4,5].map(i => <line key={`v${i}`} x1={58+i*14} y1="10" x2={58+i*14} y2="40"/>)}
          {[0,1,2].map(i => <line key={`h${i}`} x1="58" y1={10+i*10} x2="142" y2={10+i*10}/>)}
        </g>

        {/* Big background ball — slow drift + spin, tucked behind the player */}
        <motion.g
          animate={{ y: [0,-8,0], x: [0,5,0], rotate: [0,360] }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "164px 56px" }}
          opacity={0.9}
        >
          <SoccerBall cx={164} cy={56} r={22} uid="bg" />
        </motion.g>

        {/* ── Floor shadow ── */}
        <motion.ellipse cx="100" cy="226" rx="38" ry="5"
          fill="#5CA9E0" opacity="0.15"
          animate={{ rx:[36,40,36] }}
          transition={{ duration:3.5, repeat:Infinity }}
        />

        {/* ══════════ LEGS ══════════ */}
        <motion.path
          d="M 84 172 Q 76 188 70 204"
          stroke="url(#skinG)" strokeWidth="13" strokeLinecap="round" fill="none"
          animate={{ d: isSad
            ? "M 84 172 Q 72 192 64 210"
            : isHappy ? "M 84 172 Q 80 186 78 200"
            : "M 84 172 Q 76 188 70 204" }}
          transition={{ duration:0.5, ease:"easeOut" }}
        />
        {/* Left sock (white w/ sky-blue trim) + boot */}
        <motion.path d="M 70 204 Q 66 210 65 214" stroke="url(#whiteG)" strokeWidth="9" strokeLinecap="round" fill="none"/>
        <path d="M 68 202 Q 66 208 65 212" stroke="url(#skyG)" strokeWidth="2" strokeLinecap="round" fill="none"/>
        <motion.path
          d="M 65 214 Q 58 220 52 220 Q 62 226 76 220 Q 76 216 65 214 Z"
          fill="#111" stroke="#000" strokeWidth="0.5"
          animate={{ y: isSad?[0,3,0]:[0,-2,0] }}
          transition={{ duration:1.4, repeat:Infinity }}
        />
        <path d="M 58 217 Q 64 215 72 216" stroke="#FFC300" strokeWidth="0.8" opacity="0.6"/>

        <motion.path
          d="M 116 172 Q 124 188 130 204"
          stroke="url(#skinG)" strokeWidth="13" strokeLinecap="round" fill="none"
          animate={{ d: isSad
            ? "M 116 172 Q 128 192 136 210"
            : isHappy ? "M 116 172 Q 120 186 122 200"
            : "M 116 172 Q 124 188 130 204" }}
          transition={{ duration:0.5, ease:"easeOut" }}
        />
        <motion.path d="M 130 204 Q 134 210 135 214" stroke="url(#whiteG)" strokeWidth="9" strokeLinecap="round" fill="none"/>
        <path d="M 132 202 Q 134 208 135 212" stroke="url(#skyG)" strokeWidth="2" strokeLinecap="round" fill="none"/>
        <motion.path
          d="M 135 214 Q 142 220 148 220 Q 138 226 124 220 Q 124 216 135 214 Z"
          fill="#111" stroke="#000" strokeWidth="0.5"
          animate={{ y: isSad?[0,3,0]:[0,-2,0] }}
          transition={{ duration:1.4, repeat:Infinity, delay:0.3 }}
        />
        <path d="M 128 216 Q 136 214 142 217" stroke="#FFC300" strokeWidth="0.8" opacity="0.6"/>

        {/* Shorts — black with sky-blue side stripe */}
        <path d="M 78 158 Q 100 164 122 158 Q 126 172 118 178 L 100 174 L 82 178 Q 74 172 78 158 Z"
          fill="url(#shortsG)"/>
        <path d="M 79 160 Q 76 170 80 177" stroke="url(#skyG)" strokeWidth="2" fill="none" opacity="0.85"/>
        <path d="M 121 160 Q 124 170 120 177" stroke="url(#skyG)" strokeWidth="2" fill="none" opacity="0.85"/>

        {/* ══════════ ARMS (sky sleeve, skin forearm) ══════════ */}
        <motion.line x1={la.x1} y1={la.y1} x2={la.x2} y2={la.y2}
          stroke="url(#skyG)" strokeWidth="12" strokeLinecap="round"
          animate={{ x2:la.x2, y2:la.y2 }} transition={{ duration:0.45, ease:"easeOut" }}
        />
        <motion.line x1={la.x2} y1={la.y2} x2={la.x3} y2={la.y3}
          stroke="url(#skinG)" strokeWidth="10" strokeLinecap="round"
          animate={{ x1:la.x2, y1:la.y2, x2:la.x3, y2:la.y3 }} transition={{ duration:0.45, ease:"easeOut" }}
        />
        <motion.circle cx={la.x3} cy={la.y3} r="6.5" fill="url(#skinG)"
          animate={{ cx:la.x3, cy:la.y3 }} transition={{ duration:0.45, ease:"easeOut" }}
        />

        <motion.line x1={ra.x1} y1={ra.y1} x2={ra.x2} y2={ra.y2}
          stroke="url(#skyG)" strokeWidth="12" strokeLinecap="round"
          animate={{ x2:ra.x2, y2:ra.y2 }} transition={{ duration:0.45, ease:"easeOut" }}
        />
        <motion.line x1={ra.x2} y1={ra.y2} x2={ra.x3} y2={ra.y3}
          stroke="url(#skinG)" strokeWidth="10" strokeLinecap="round"
          animate={{ x1:ra.x2, y1:ra.y2, x2:ra.x3, y2:ra.y3 }} transition={{ duration:0.45, ease:"easeOut" }}
        />
        <motion.circle cx={ra.x3} cy={ra.y3} r="6.5" fill="url(#skinG)"
          animate={{ cx:ra.x3, cy:ra.y3 }} transition={{ duration:0.45, ease:"easeOut" }}
        />

        {/* ══════════ TORSO — Argentina jersey stripes (clipped to silhouette) ══════════ */}
        <path d="M 78 118 Q 64 130 64 158 Q 72 178 100 180 Q 128 178 136 158 Q 136 130 122 118 Q 110 124 100 124 Q 90 124 78 118 Z"
          fill="url(#whiteG)"/>
        <g clipPath="url(#torsoClip)">
          {[-28,-14,0,14,28].map((dx,i)=>(
            <rect key={i} x={100+dx-5} y="110" width="10" height="80" fill="url(#skyG)" opacity="0.95"/>
          ))}
        </g>
        <path d="M 78 118 Q 64 130 64 158 Q 72 178 100 180 Q 128 178 136 158 Q 136 130 122 118 Q 110 124 100 124 Q 90 124 78 118 Z"
          fill="url(#mShade)"/>

        {/* Collar */}
        <path d="M 88 118 Q 100 126 112 118 L 108 112 Q 100 118 92 112 Z" fill="url(#skyG)"/>
        <path d="M 89 117 Q 100 123 111 117" stroke="white" strokeWidth="1.2" fill="none" opacity="0.8"/>

        {/* Third star + number */}
        <text x="100" y="132" textAnchor="middle" fontSize="9" fill="#FFC300" opacity="0.9">★</text>
        <text x="100" y="158" textAnchor="middle" fontSize="27" fontWeight="700"
          fill="#14202B" fontFamily="Arial, sans-serif" opacity="0.88">10</text>

        {/* ══════════ NECK ══════════ */}
        <path d="M 90 110 Q 100 114 110 110 L 112 120 Q 100 124 88 120 Z" fill="url(#skinG)"/>

        {/* ══════════ HEAD ══════════ */}
        <motion.ellipse cx="100" cy="76" rx="33" ry="35"
          fill="url(#skinG)"
          animate={{ ry: isSurprise?38:35 }}
          transition={{ duration:0.3 }}
        />
        <motion.ellipse cx="100" cy="76" rx="33" ry="35"
          fill="url(#mShade)"
          animate={{ ry: isSurprise?38:35 }}
          transition={{ duration:0.3 }}
        />

        {/* Hair — short wavy fringe with a subtle fade at the sides */}
        <path d="M 68 64 Q 62 30 100 28 Q 138 30 132 64 Q 128 42 116 40 Q 122 48 118 54 Q 108 42 100 42 Q 92 42 82 54 Q 78 48 84 40 Q 72 42 68 64 Z" fill="url(#hairG)"/>
        <path d="M 65 58 Q 61 76 68 90 Q 63 74 66 56 Z" fill="url(#hairG)"/>
        <path d="M 135 58 Q 139 76 132 90 Q 137 74 134 56 Z" fill="url(#hairG)"/>

        {/* Ears */}
        <ellipse cx="66" cy="80" rx="4" ry="6" fill="url(#skinG)"/>
        <ellipse cx="134" cy="80" rx="4" ry="6" fill="url(#skinG)"/>

        {/* Light beard shadow */}
        <path d="M 78 90 Q 100 106 122 90 Q 122 102 100 110 Q 78 102 78 90 Z"
          fill="#7A4A2E" opacity="0.16"/>

        {/* Eyebrows */}
        <motion.path d="M 75 61 Q 82 57 89 60" stroke="#1E140D" strokeWidth="2.4" strokeLinecap="round" fill="none"
          animate={{ rotate: brow.l }} style={{ transformOrigin: "82px 59px" }} transition={{ duration:0.3 }}
        />
        <motion.path d="M 111 60 Q 118 57 125 61" stroke="#1E140D" strokeWidth="2.4" strokeLinecap="round" fill="none"
          animate={{ rotate: brow.r }} style={{ transformOrigin: "118px 59px" }} transition={{ duration:0.3 }}
        />

        {/* Eyes */}
        <motion.g animate={{ scaleY: eyeScale[emotion] }} style={{ transformOrigin: "82px 70px" }} transition={{ duration:0.25 }}>
          <ellipse cx="82" cy="70" rx="6.5" ry="5.6" fill="white"/>
          <motion.circle cx="83" cy="70" r="3.2" fill="#2A1B10"
            animate={{ cx: isThinking?85:isSad?81:83 }} transition={{ duration:0.3 }}
          />
          <circle cx="84.3" cy="68.6" r="0.9" fill="white"/>
        </motion.g>
        <motion.g animate={{ scaleY: eyeScale[emotion] }} style={{ transformOrigin: "118px 70px" }} transition={{ duration:0.25 }}>
          <ellipse cx="118" cy="70" rx="6.5" ry="5.6" fill="white"/>
          <motion.circle cx="119" cy="70" r="3.2" fill="#2A1B10"
            animate={{ cx: isThinking?121:isSad?117:119 }} transition={{ duration:0.3 }}
          />
          <circle cx="120.3" cy="68.6" r="0.9" fill="white"/>
        </motion.g>

        {/* Mouth open fill */}
        <AnimatePresence>
          {(isTalking || isSurprise) && (
            <motion.path
              d={mouthFill[emotion] || mouthFill.talking}
              fill="#7A2E2E"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.15 }}
            />
          )}
        </AnimatePresence>

        {/* Teeth */}
        <AnimatePresence>
          {(isTalking || isSurprise) && (
            <motion.path
              d="M 91 106 Q 100 111 109 106 L 107 103 Q 100 107 93 103 Z"
              fill="white" opacity="0.9"
              initial={{ opacity:0, scaleY:0 }} animate={{ opacity:0.9, scaleY:1 }} exit={{ opacity:0, scaleY:0 }}
              style={{ transformOrigin:"100px 106px" }} transition={{ duration:0.15 }}
            />
          )}
        </AnimatePresence>

        {/* Mouth line */}
        <motion.path
          d={mouthPath[emotion]}
          stroke="#7A3B2E" strokeWidth="2.2" strokeLinecap="round" fill="none"
          animate={{
            d: isTalking
              ? [
                  "M 85 106 Q 100 116 115 106",
                  "M 85 107 Q 100 120 115 107",
                  "M 87 106 Q 100 113 113 106",
                  "M 85 107 Q 100 120 115 107",
                  "M 85 106 Q 100 116 115 106",
                ]
              : mouthPath[emotion],
          }}
          transition={
            isTalking
              ? { duration:0.35, repeat:Infinity, ease:"easeInOut" }
              : { duration:0.3 }
          }
        />

        {/* ══════════ SOCCER BALL — at the foot, bounces on talk/excited ══════════ */}
        <motion.g
          animate={{
            y: isTalking ? [0,-10,0] : isExcited ? [0,-18,0] : [0,-3,0],
            x: isExcited ? [0,7,0] : 0,
            rotate: isTalking || isExcited ? [0,180,360] : 0,
          }}
          transition={{ duration: isExcited?0.6:0.9, repeat:Infinity, ease:"easeInOut" }}
          style={{ transformOrigin: "150px 214px" }}
        >
          <SoccerBall cx={150} cy={214} r={11} uid="foot" />
        </motion.g>

        {/* ══════════ THINKING BUBBLES ══════════ */}
        <AnimatePresence>
          {isThinking && [0,1,2].map(i=>(
            <motion.circle key={i}
              cx={155+i*10} cy={55-i*5} r={3+i*1.5}
              fill="white" opacity="0.6"
              initial={{ scale:0, opacity:0 }}
              animate={{ scale:[0,1,0], opacity:[0,0.7,0] }}
              exit={{ opacity:0 }}
              transition={{ duration:1.3, repeat:Infinity, delay:i*0.32 }}
            />
          ))}
        </AnimatePresence>

        {/* ══════════ EXCITED SPARKLES ══════════ */}
        <AnimatePresence>
          {isHappy && [
            {x:18, y:52, delay:0},
            {x:176,y:48, delay:0.2},
            {x:14, y:105,delay:0.4},
            {x:180,y:105,delay:0.6},
          ].map((s,i)=>(
            <motion.text key={i} x={s.x} y={s.y} fontSize="15"
              initial={{opacity:0,scale:0}}
              animate={{opacity:[0,1,0],scale:[0.5,1.4,0.5],y:[s.y,s.y-16,s.y]}}
              exit={{opacity:0}}
              transition={{duration:1.1,repeat:Infinity,delay:s.delay}}
            >⚽</motion.text>
          ))}
        </AnimatePresence>

        {/* ══════════ SAD TEARS ══════════ */}
        <AnimatePresence>
          {isSad && [{cx:78,delay:0},{cx:122,delay:0.7}].map((t,i)=>(
            <motion.ellipse key={i}
              cx={t.cx} cy={82} rx="2.5" ry="5"
              fill="#93C5FD"
              initial={{cy:82,opacity:0}}
              animate={{cy:[82,102],opacity:[0.9,0]}}
              exit={{opacity:0}}
              transition={{duration:1.5,repeat:Infinity,delay:t.delay}}
            />
          ))}
        </AnimatePresence>

        {/* ══════════ AMBIENT GLOW (emotion colour) ══════════ */}
        <motion.ellipse
          cx="100" cy="130" rx="50" ry="55"
          fill={isHappy?"#FBBF24":isSad?"#0044FF":isThinking?"#8800FF":isSurprise?"#00AA44":"#5CA9E0"}
          opacity="0.04"
          animate={{ opacity:[0.03,0.07,0.03], ry:[53,57,53] }}
          transition={{ duration:2.8, repeat:Infinity, ease:"easeInOut" }}
        />

      </svg>
    </motion.div>
  );
}
