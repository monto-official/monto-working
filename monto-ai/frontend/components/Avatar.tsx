"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Emotion } from "@/types";

interface AvatarProps {
  emotion: Emotion;
  size?: number;
}

export function Avatar({ emotion, size = 320 }: AvatarProps) {
  const isTalking  = emotion === "talking";
  const isHappy    = emotion === "happy" || emotion === "excited";
  const isSad      = emotion === "sad";
  const isThinking = emotion === "thinking";
  const isSurprise = emotion === "surprised";
  const isExcited  = emotion === "excited";

  // ── Mouth shapes (lower mask panel, Spider-Man fabric stretch style) ────
  const mouthPath: Record<Emotion, string> = {
    happy:     "M 84 104 Q 100 114 116 104",   // big smile
    excited:   "M 82 102 Q 100 116 118 102",   // huge grin
    sad:       "M 86 110 Q 100 102 114 110",   // frown
    thinking:  "M 88 107 Q 100 107 112 107",   // flat/smirk
    surprised: "M 92 104 Q 100 112 108 104",   // small O
    neutral:   "M 87 106 Q 100 110 113 106",   // slight smile
    talking:   "M 85 104 Q 100 114 115 104",   // open talking
  };
  // Mouth open fill path for talking/surprised (shows inside)
  const mouthFill: Record<Emotion, string> = {
    happy:     "",
    excited:   "",
    sad:       "",
    thinking:  "",
    surprised: "M 92 104 Q 100 116 108 104 Q 100 108 92 104 Z",
    neutral:   "",
    talking:   "M 85 104 Q 100 118 115 104 Q 100 110 85 104 Z",
  };

  // ── Lens shapes — bigger, more expressive ───────────────────────────────
  const leftLens: Record<Emotion, string> = {
    happy:     "M 68 76 C 72 64 88 62 96 70 C 90 80 72 82 68 76 Z",
    excited:   "M 64 72 C 70 58 90 56 98 68 C 90 82 66 82 64 72 Z",
    sad:       "M 70 82 C 74 72 88 72 94 78 C 88 88 72 90 70 82 Z",
    thinking:  "M 70 80 C 74 70 88 70 94 76 C 88 84 72 86 70 80 Z",
    surprised: "M 64 74 C 68 58 90 56 98 68 C 90 84 66 86 64 74 Z",
    neutral:   "M 68 78 C 72 66 88 64 96 72 C 90 82 72 84 68 78 Z",
    talking:   "M 68 78 C 72 66 88 64 96 72 C 90 82 72 84 68 78 Z",
  };
  const rightLens: Record<Emotion, string> = {
    happy:     "M 104 70 C 112 62 128 64 132 76 C 128 82 108 80 104 70 Z",
    excited:   "M 102 68 C 110 56 130 58 136 72 C 130 82 104 82 102 68 Z",
    sad:       "M 106 78 C 112 72 126 72 130 82 C 126 90 108 88 106 78 Z",
    thinking:  "M 106 76 C 112 70 126 70 130 80 C 126 86 108 84 106 76 Z",
    surprised: "M 102 68 C 110 56 130 58 136 72 C 130 84 104 86 102 68 Z",
    neutral:   "M 104 72 C 112 64 128 66 132 78 C 128 84 108 82 104 72 Z",
    talking:   "M 104 72 C 112 64 128 66 132 78 C 128 84 108 82 104 72 Z",
  };

  // ── Arm keyframes ────────────────────────────────────────────────────────
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
          {/* Suit gradients */}
          <radialGradient id="redG" cx="38%" cy="28%" r="65%">
            <stop offset="0%" stopColor="#FF4444"/>
            <stop offset="55%" stopColor="#CC0000"/>
            <stop offset="100%" stopColor="#7F0000"/>
          </radialGradient>
          <radialGradient id="blueG" cx="40%" cy="28%" r="65%">
            <stop offset="0%" stopColor="#4488FF"/>
            <stop offset="55%" stopColor="#1144CC"/>
            <stop offset="100%" stopColor="#0A1F6B"/>
          </radialGradient>
          <radialGradient id="headG" cx="38%" cy="25%" r="68%">
            <stop offset="0%" stopColor="#FF5555"/>
            <stop offset="50%" stopColor="#DD0000"/>
            <stop offset="100%" stopColor="#880000"/>
          </radialGradient>
          {/* Eye glow */}
          <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1"/>
            <stop offset="60%" stopColor="#E0F0FF" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#A0C8FF" stopOpacity="0.7"/>
          </radialGradient>
          {/* Muscle shading */}
          <radialGradient id="chestShade" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="black" stopOpacity="0.22"/>
          </radialGradient>
          {/* Glow filter */}
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="eyeFilter" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="webGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.8" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Floor shadow ── */}
        <motion.ellipse cx="100" cy="226" rx="38" ry="5"
          fill="#FF0000" opacity="0.1"
          animate={{ rx:[36,40,36] }}
          transition={{ duration:3.5, repeat:Infinity }}
        />

        {/* ══════════ LEGS ══════════ */}
        {/* Left leg — blue upper, red boot */}
        <motion.path
          d="M 84 172 Q 76 188 70 204"
          stroke="url(#blueG)" strokeWidth="14" strokeLinecap="round" fill="none"
          animate={{ d: isSad
            ? "M 84 172 Q 72 192 64 210"
            : isHappy ? "M 84 172 Q 80 186 78 200"
            : "M 84 172 Q 76 188 70 204" }}
          transition={{ duration:0.5, ease:"easeOut" }}
        />
        {/* Left boot */}
        <motion.path
          d="M 70 204 Q 62 212 56 214 Q 66 220 78 212 Q 78 206 70 204 Z"
          fill="url(#redG)" stroke="#880000" strokeWidth="0.5"
          animate={{ y: isSad?[0,3,0]:[0,-2,0] }}
          transition={{ duration:1.4, repeat:Infinity }}
        />
        {/* Boot toe highlight */}
        <path d="M 60 214 Q 66 212 74 213" stroke="#FF6666" strokeWidth="1" opacity="0.5"/>

        {/* Right leg */}
        <motion.path
          d="M 116 172 Q 124 188 130 204"
          stroke="url(#blueG)" strokeWidth="14" strokeLinecap="round" fill="none"
          animate={{ d: isSad
            ? "M 116 172 Q 128 192 136 210"
            : isHappy ? "M 116 172 Q 120 186 122 200"
            : "M 116 172 Q 124 188 130 204" }}
          transition={{ duration:0.5, ease:"easeOut" }}
        />
        {/* Right boot */}
        <motion.path
          d="M 130 204 Q 138 212 144 214 Q 134 220 122 212 Q 122 206 130 204 Z"
          fill="url(#redG)" stroke="#880000" strokeWidth="0.5"
          animate={{ y: isSad?[0,3,0]:[0,-2,0] }}
          transition={{ duration:1.4, repeat:Infinity, delay:0.3 }}
        />
        <path d="M 140 214 Q 134 212 126 213" stroke="#FF6666" strokeWidth="1" opacity="0.5"/>

        {/* Knee caps */}
        <motion.circle cx="76" cy="188" r="5" fill="url(#redG)" opacity="0.7"
          animate={{ cx:isSad?72:76 }} transition={{ duration:0.5 }} />
        <motion.circle cx="124" cy="188" r="5" fill="url(#redG)" opacity="0.7"
          animate={{ cx:isSad?128:124 }} transition={{ duration:0.5 }} />

        {/* ══════════ ARMS ══════════ */}
        {/* LEFT — upper arm red, forearm blue */}
        <motion.line x1={la.x1} y1={la.y1} x2={la.x2} y2={la.y2}
          stroke="url(#redG)" strokeWidth="12" strokeLinecap="round"
          animate={{ x2:la.x2, y2:la.y2 }} transition={{ duration:0.45, ease:"easeOut" }}
        />
        <motion.line x1={la.x2} y1={la.y2} x2={la.x3} y2={la.y3}
          stroke="url(#blueG)" strokeWidth="10" strokeLinecap="round"
          animate={{ x1:la.x2, y1:la.y2, x2:la.x3, y2:la.y3 }} transition={{ duration:0.45, ease:"easeOut" }}
        />
        {/* Left glove */}
        <motion.circle cx={la.x3} cy={la.y3} r="7" fill="url(#redG)"
          animate={{ cx:la.x3, cy:la.y3 }} transition={{ duration:0.45, ease:"easeOut" }}
        />
        {/* Web shooter detail */}
        <motion.circle cx={la.x3} cy={la.y3} r="3.5" fill="#880000"
          animate={{ cx:la.x3, cy:la.y3 }} transition={{ duration:0.45 }}
        />
        <AnimatePresence>
          {(isHappy||isTalking) && (
            <motion.circle cx={la.x3} cy={la.y3} r="7"
              stroke="#FFF" strokeWidth="1.5" fill="none"
              initial={{scale:1,opacity:0.9}}
              animate={{scale:[1,2.8],opacity:[0.9,0]}}
              exit={{opacity:0}}
              transition={{duration:0.8,repeat:Infinity}}
            />
          )}
        </AnimatePresence>

        {/* RIGHT upper arm red, forearm blue */}
        <motion.line x1={ra.x1} y1={ra.y1} x2={ra.x2} y2={ra.y2}
          stroke="url(#redG)" strokeWidth="12" strokeLinecap="round"
          animate={{ x2:ra.x2, y2:ra.y2 }} transition={{ duration:0.45, ease:"easeOut" }}
        />
        <motion.line x1={ra.x2} y1={ra.y2} x2={ra.x3} y2={ra.y3}
          stroke="url(#blueG)" strokeWidth="10" strokeLinecap="round"
          animate={{ x1:ra.x2, y1:ra.y2, x2:ra.x3, y2:ra.y3 }} transition={{ duration:0.45, ease:"easeOut" }}
        />
        {/* Right glove */}
        <motion.circle cx={ra.x3} cy={ra.y3} r="7" fill="url(#redG)"
          animate={{ cx:ra.x3, cy:ra.y3 }} transition={{ duration:0.45, ease:"easeOut" }}
        />
        <motion.circle cx={ra.x3} cy={ra.y3} r="3.5" fill="#880000"
          animate={{ cx:ra.x3, cy:ra.y3 }} transition={{ duration:0.45 }}
        />

        {/* ══════════ TORSO ══════════ */}
        {/* Blue sides / back */}
        <path d="M 78 118 Q 64 130 64 158 Q 72 178 100 180 Q 128 178 136 158 Q 136 130 122 118 Q 110 124 100 124 Q 90 124 78 118 Z"
          fill="url(#blueG)"/>
        {/* Red chest panel */}
        <path d="M 84 118 Q 100 128 116 118 Q 126 136 122 162 Q 112 178 100 180 Q 88 178 78 162 Q 74 136 84 118 Z"
          fill="url(#redG)"/>
        {/* Chest shading overlay */}
        <path d="M 84 118 Q 100 128 116 118 Q 126 136 122 162 Q 112 178 100 180 Q 88 178 78 162 Q 74 136 84 118 Z"
          fill="url(#chestShade)"/>

        {/* Chest web lines */}
        <path d="M 100 118 L 100 180" stroke="#880000" strokeWidth="0.6" opacity="0.55"/>
        <path d="M 84 118 Q 80 148 78 162" stroke="#880000" strokeWidth="0.6" opacity="0.45"/>
        <path d="M 116 118 Q 120 148 122 162" stroke="#880000" strokeWidth="0.6" opacity="0.45"/>
        <path d="M 76 130 Q 100 127 124 130" stroke="#880000" strokeWidth="0.6" opacity="0.45"/>
        <path d="M 74 142 Q 100 139 126 142" stroke="#880000" strokeWidth="0.6" opacity="0.45"/>
        <path d="M 76 154 Q 100 151 124 154" stroke="#880000" strokeWidth="0.6" opacity="0.45"/>
        <path d="M 80 166 Q 100 163 120 166" stroke="#880000" strokeWidth="0.6" opacity="0.4"/>

        {/* ── Spider emblem ── */}
        <motion.g
          style={{ transformOrigin:"100px 148px" }}
          animate={{ scale: isTalking?[1,1.12,1]:isHappy?[1,1.08,1]:[1,1.02,1] }}
          transition={{ duration:0.45, repeat:Infinity }}
        >
          <ellipse cx="100" cy="150" rx="6" ry="8" fill="black" opacity="0.9"/>
          <ellipse cx="100" cy="142" rx="5" ry="5" fill="black" opacity="0.9"/>
          {/* 8 spider legs */}
          {[
            [-10,-2],[-12,2],[-8,7],[8,-2],[12,2],[8,7],
            [-5,-8],[5,-8]
          ].map(([dx,dy],i)=>(
            <line key={i} x1="100" y1="148" x2={100+dx} y2={148+dy}
              stroke="black" strokeWidth="1.2" opacity="0.85"/>
          ))}
        </motion.g>

        {/* Belt line */}
        <path d="M 76 170 Q 100 174 124 170 Q 128 176 100 178 Q 72 176 76 170 Z"
          fill="url(#blueG)" opacity="0.9"/>
        <path d="M 96 172 Q 100 174 104 172 Q 104 176 100 176 Q 96 176 96 172 Z"
          fill="#FFC300" opacity="0.85"/>

        {/* ══════════ NECK ══════════ */}
        <path d="M 90 112 Q 100 116 110 112 L 112 122 Q 100 126 88 122 Z"
          fill="url(#redG)"/>

        {/* ══════════ HEAD ══════════ */}
        <motion.ellipse cx="100" cy="78" rx="38" ry="40"
          fill="url(#headG)"
          animate={{ ry: isSurprise?43:40 }}
          transition={{ duration:0.3 }}
        />
        {/* Head shading */}
        <motion.ellipse cx="100" cy="78" rx="38" ry="40"
          fill="url(#chestShade)"
          animate={{ ry: isSurprise?43:40 }}
          transition={{ duration:0.3 }}
        />

        {/* ── Web lines on head ── */}
        {/* Center vertical */}
        <path d="M 100 38 L 100 118" stroke="#880000" strokeWidth="0.65" opacity="0.5"/>
        {/* Horizontal arcs */}
        <path d="M 63 62 Q 100 58 137 62" stroke="#880000" strokeWidth="0.65" opacity="0.45"/>
        <path d="M 62 74 Q 100 70 138 74" stroke="#880000" strokeWidth="0.65" opacity="0.45"/>
        <path d="M 62 86 Q 100 82 138 86" stroke="#880000" strokeWidth="0.65" opacity="0.45"/>
        <path d="M 64 98 Q 100 94 136 98" stroke="#880000" strokeWidth="0.65" opacity="0.45"/>
        <path d="M 70 110 Q 100 106 130 110" stroke="#880000" strokeWidth="0.65" opacity="0.4"/>
        {/* Left diagonals */}
        <path d="M 100 38 Q 80 56 62 74" stroke="#880000" strokeWidth="0.65" opacity="0.4"/>
        <path d="M 100 38 Q 74 64 63 86" stroke="#880000" strokeWidth="0.65" opacity="0.4"/>
        <path d="M 100 38 Q 72 78 66 98" stroke="#880000" strokeWidth="0.65" opacity="0.4"/>
        <path d="M 100 38 Q 76 90 70 110" stroke="#880000" strokeWidth="0.65" opacity="0.35"/>
        {/* Right diagonals */}
        <path d="M 100 38 Q 120 56 138 74" stroke="#880000" strokeWidth="0.65" opacity="0.4"/>
        <path d="M 100 38 Q 126 64 137 86" stroke="#880000" strokeWidth="0.65" opacity="0.4"/>
        <path d="M 100 38 Q 128 78 134 98" stroke="#880000" strokeWidth="0.65" opacity="0.4"/>
        <path d="M 100 38 Q 124 90 130 110" stroke="#880000" strokeWidth="0.65" opacity="0.35"/>

        {/* ══════════ MOUTH (lower mask fabric stretch) ══════════ */}
        {/* Mask chin panel — slightly lighter red zone */}
        <motion.ellipse cx="100" cy="107" rx="18" ry="9"
          fill="#CC0000" opacity="0.45"
          animate={{ ry: isSurprise?11:isTalking?[8,11,8]:9 }}
          transition={{ duration:0.25, repeat: isTalking?Infinity:0 }}
        />

        {/* Mouth open fill (dark inside) */}
        <AnimatePresence>
          {(isTalking || isSurprise) && (
            <motion.path
              d={mouthFill[emotion] || mouthFill.talking}
              fill="#1a0000"
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              exit={{ opacity:0 }}
              transition={{ duration:0.15 }}
            />
          )}
        </AnimatePresence>

        {/* Teeth (visible when talking/surprised) */}
        <AnimatePresence>
          {(isTalking || isSurprise) && (
            <motion.path
              d="M 91 107 Q 100 112 109 107 L 107 104 Q 100 108 93 104 Z"
              fill="white" opacity="0.9"
              initial={{ opacity:0, scaleY:0 }}
              animate={{ opacity:0.9, scaleY:1 }}
              exit={{ opacity:0, scaleY:0 }}
              style={{ transformOrigin:"100px 107px" }}
              transition={{ duration:0.15 }}
            />
          )}
        </AnimatePresence>

        {/* Main mouth line */}
        <motion.path
          d={mouthPath[emotion]}
          stroke="#660000" strokeWidth="2.2" strokeLinecap="round" fill="none"
          animate={{
            d: isTalking
              ? [
                  "M 85 104 Q 100 114 115 104",
                  "M 85 105 Q 100 118 115 105",
                  "M 87 104 Q 100 111 113 104",
                  "M 85 105 Q 100 118 115 105",
                  "M 85 104 Q 100 114 115 104",
                ]
              : mouthPath[emotion],
          }}
          transition={
            isTalking
              ? { duration:0.35, repeat:Infinity, ease:"easeInOut" }
              : { duration:0.3 }
          }
        />

        {/* Mouth corner dimples */}
        <motion.circle cx="85" cy="105" r="1.5" fill="#880000" opacity="0.6"
          animate={{ cx: isHappy?83:isSad?87:85, cy: isHappy?103:isSad?109:105 }}
          transition={{ duration:0.3 }}
        />
        <motion.circle cx="115" cy="105" r="1.5" fill="#880000" opacity="0.6"
          animate={{ cx: isHappy?117:isSad?113:115, cy: isHappy?103:isSad?109:105 }}
          transition={{ duration:0.3 }}
        />

        {/* ══════════ EYES ══════════ */}        {/* Outer glow */}
        <motion.path d={leftLens[emotion]} fill="white" opacity="0.25" filter="url(#eyeFilter)"
          style={{ scale:1.25 }}
          animate={{ d:leftLens[emotion] }} transition={{ duration:0.25 }}
        />
        <motion.path d={rightLens[emotion]} fill="white" opacity="0.25" filter="url(#eyeFilter)"
          style={{ scale:1.25 }}
          animate={{ d:rightLens[emotion] }} transition={{ duration:0.25 }}
        />
        {/* Main lenses */}
        <motion.path d={leftLens[emotion]} fill="url(#eyeGlow)" filter="url(#eyeFilter)"
          animate={{ d:leftLens[emotion] }} transition={{ duration:0.25 }}
        />
        <motion.path d={rightLens[emotion]} fill="url(#eyeGlow)" filter="url(#eyeFilter)"
          animate={{ d:rightLens[emotion] }} transition={{ duration:0.25 }}
        />
        {/* Eye shimmer lines */}
        <motion.path d={leftLens[emotion]} fill="none" stroke="white" strokeWidth="0.8"
          opacity="0.5"
          animate={{ d:leftLens[emotion], opacity: isTalking?[0.5,1,0.5]:0.5 }}
          transition={{ duration:0.3, repeat:Infinity }}
        />
        <motion.path d={rightLens[emotion]} fill="none" stroke="white" strokeWidth="0.8"
          opacity="0.5"
          animate={{ d:rightLens[emotion], opacity: isTalking?[0.5,1,0.5]:0.5 }}
          transition={{ duration:0.3, repeat:Infinity, delay:0.15 }}
        />

        {/* ══════════ WEB SHOT ══════════ */}
        <AnimatePresence>
          {isTalking && (
            <motion.path
              d={`M ${ra.x3} ${ra.y3} Q ${ra.x3+30} ${ra.y3-25} 188 25`}
              stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"
              opacity="0.85"
              initial={{ pathLength:0, opacity:0.9 }}
              animate={{ pathLength:[0,1,0], opacity:[0.9,0.9,0] }}
              exit={{ opacity:0 }}
              transition={{ duration:0.55, repeat:Infinity, repeatDelay:0.35 }}
            />
          )}
          {isExcited && (
            <motion.path
              d={`M ${la.x3} ${la.y3} Q ${la.x3-30} ${la.y3-25} 12 25`}
              stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"
              opacity="0.85"
              initial={{ pathLength:0, opacity:0.9 }}
              animate={{ pathLength:[0,1,0], opacity:[0.9,0.9,0] }}
              exit={{ opacity:0 }}
              transition={{ duration:0.55, repeat:Infinity, repeatDelay:0.35, delay:0.2 }}
            />
          )}
        </AnimatePresence>

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
            >✨</motion.text>
          ))}
        </AnimatePresence>

        {/* ══════════ SAD TEARS ══════════ */}
        <AnimatePresence>
          {isSad && [{cx:78,delay:0},{cx:122,delay:0.7}].map((t,i)=>(
            <motion.ellipse key={i}
              cx={t.cx} cy={92} rx="2.5" ry="5"
              fill="#93C5FD"
              initial={{cy:92,opacity:0}}
              animate={{cy:[92,112],opacity:[0.9,0]}}
              exit={{opacity:0}}
              transition={{duration:1.5,repeat:Infinity,delay:t.delay}}
            />
          ))}
        </AnimatePresence>

        {/* ══════════ AMBIENT SUIT GLOW (emotion colour) ══════════ */}
        <motion.ellipse
          cx="100" cy="130" rx="50" ry="55"
          fill={isHappy?"#FF0000":isSad?"#0044FF":isThinking?"#8800FF":isSurprise?"#00AA44":"#CC0000"}
          opacity="0.04"
          animate={{ opacity:[0.03,0.07,0.03], ry:[53,57,53] }}
          transition={{ duration:2.8, repeat:Infinity, ease:"easeInOut" }}
        />

      </svg>
    </motion.div>
  );
}
