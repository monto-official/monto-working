"use client";
/**
 * ExplorePanel — Interactive educational mode for Monto AI.
 * Detects topic from transcript and shows animated learning scenes.
 * Monto narrates each step while animation plays.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { SolarSystem } from "@/components/explore/SolarSystem";
import { Photosynthesis } from "@/components/explore/Photosynthesis";
import { AnimalLife } from "@/components/explore/AnimalLife";
import { WaterCycle } from "@/components/explore/WaterCycle";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ExploreScene = "solar-system" | "photosynthesis" | "animal-life" | "water-cycle" | null;

interface Step {
  narration: string;
  highlight?: string;
  duration:  number; // ms
}

interface Props {
  scene:      ExploreScene;
  transcript: string;
  onClose:    () => void;
  onNarrate:  (text: string, onDone: () => void) => void;
  isSpeaking: boolean;
}

// ─── Narration scripts ────────────────────────────────────────────────────────
const SCRIPTS: Record<NonNullable<ExploreScene>, (ctx: string) => Step[]> = {
  "solar-system": () => [
    { narration: "Welcome to our Solar System! 🌟 Let's explore the planets one by one!", highlight: "", duration: 4000 },
    { narration: "Mercury is the closest planet to the Sun! It's tiny and super fast! ☿", highlight: "Mercury", duration: 5000 },
    { narration: "Venus is the hottest planet — even hotter than Mercury! 🌡️", highlight: "Venus", duration: 5000 },
    { narration: "Earth is our home! It's the only planet with life — so far! 🌍", highlight: "Earth", duration: 5000 },
    { narration: "Mars is called the Red Planet! Scientists think we might visit there one day! 🚀", highlight: "Mars", duration: 5000 },
    { narration: "Jupiter is the BIGGEST planet! It has a giant storm called the Great Red Spot! ⚡", highlight: "Jupiter", duration: 5500 },
    { narration: "Saturn has beautiful rings made of ice and rocks! It's stunning! 💍", highlight: "Saturn", duration: 5500 },
    { narration: "Uranus is an ice giant — it even spins on its side! 🌀", highlight: "Uranus", duration: 5000 },
    { narration: "Neptune is the farthest planet — super cold and very windy! 🌊", highlight: "Neptune", duration: 5000 },
    { narration: "Amazing! You just learned all 8 planets! You're a space explorer now! 🎉", highlight: "", duration: 5000 },
  ],
  "photosynthesis": () => [
    { narration: "Let's learn how plants make their own food! It's like magic! 🌿", highlight: "", duration: 4000 },
    { narration: "Step 1: The Sun shines its energy down onto the plant's leaves! ☀️", highlight: "", duration: 5000 },
    { narration: "Step 2: The roots absorb water from the soil and send it up! 💧", highlight: "", duration: 5000 },
    { narration: "Step 3: The leaves absorb carbon dioxide from the air around them! 💨", highlight: "", duration: 5000 },
    { narration: "Step 4: Inside the leaf — PHOTOSYNTHESIS happens! Water + CO₂ + sunlight = food! ⚡", highlight: "", duration: 6000 },
    { narration: "Step 5: The plant creates glucose — that's its food and energy! 🍬", highlight: "", duration: 5000 },
    { narration: "Step 6: The plant releases oxygen into the air — that's the air WE breathe! 🌬️", highlight: "", duration: 5000 },
    { narration: "Wow! Plants are amazing! They feed themselves AND give us clean air! 🎉", highlight: "", duration: 5000 },
  ],
  "animal-life": (ctx) => {
    const animal = ["butterfly","frog","chicken","dog","cat"].find(a => ctx.toLowerCase().includes(a)) ?? "butterfly";
    return [
      { narration: `Let's learn about the life cycle of a ${animal}! 🌱`, highlight: "", duration: 4000 },
      { narration: `Stage 1: It starts at the beginning — every living thing has a beginning! 🥚`, highlight: "", duration: 5000 },
      { narration: `Stage 2: The baby grows and changes — this is called growth! 🌱`, highlight: "", duration: 5000 },
      { narration: `Stage 3: It changes even more in a special transformation! ✨`, highlight: "", duration: 5000 },
      { narration: `Stage 4: Fully grown! The ${animal} is now an adult! 🎉`, highlight: "", duration: 5000 },
      { narration: `Amazing! Every animal has its own special life cycle. Nature is wonderful! 💚`, highlight: "", duration: 5000 },
    ];
  },
  "water-cycle": () => [
    { narration: "Let's explore the amazing water cycle! Water travels around our whole planet! 🌍", highlight: "", duration: 4500 },
    { narration: "Step 1: The Sun heats water in oceans, rivers, and lakes! ☀️", highlight: "", duration: 5000 },
    { narration: "Step 2: Evaporation! Water turns into invisible vapor and floats up into the sky! 💨", highlight: "", duration: 5500 },
    { narration: "Step 3: Condensation! The vapor cools up high and forms clouds! ☁️", highlight: "", duration: 5000 },
    { narration: "Step 4: Precipitation! When clouds get heavy — it rains or snows! 🌧️", highlight: "", duration: 5000 },
    { narration: "Step 5: Water flows into rivers and streams, traveling back to the ocean! 🏔️", highlight: "", duration: 5500 },
    { narration: "And the cycle repeats — forever! The same water has been cycling for billions of years! 🌊", highlight: "", duration: 5500 },
    { narration: "Wow! The water in your glass might have been in a dinosaur once! 🦕 How cool is that?", highlight: "", duration: 5000 },
  ],
};

// ─── Topic detector ───────────────────────────────────────────────────────────
export function detectExploreScene(transcript: string): ExploreScene {
  const t = transcript.toLowerCase();
  const hasExplore = /\b(explore|show me|teach me|tell me about|let'?s learn|how do|what is|what are|explain)\b/.test(t);
  if (!hasExplore) return null;

  if (/solar|planet|space|sun|mercury|venus|earth|mars|jupiter|saturn|uranus|neptune|orbit/.test(t)) return "solar-system";
  if (/plant|photosynthesis|leaf|leaves|food|chlorophyll|oxygen|grow/.test(t)) return "photosynthesis";
  if (/butterfly|frog|chicken|egg|hatch|caterpillar|tadpole|animal|baby|born|life cycle/.test(t)) return "animal-life";
  if (/water cycle|rain|cloud|evapor|condensat|precipitation|river|ocean/.test(t)) return "water-cycle";

  return null;
}

export function isExploreIntent(transcript: string): boolean {
  return /\b(explore|let'?s explore|show me|teach me|explain)\b/i.test(transcript);
}

// ─── Scene titles ─────────────────────────────────────────────────────────────
const SCENE_TITLES: Record<NonNullable<ExploreScene>, string> = {
  "solar-system":   "🪐 Solar System",
  "photosynthesis": "🌿 How Plants Make Food",
  "animal-life":    "🦋 Animal Life Cycles",
  "water-cycle":    "💧 The Water Cycle",
};

// ─── Main component ───────────────────────────────────────────────────────────
export function ExplorePanel({ scene, transcript, onClose, onNarrate, isSpeaking }: Props) {
  const [step,        setStep]        = useState(0);
  const [totalSteps,  setTotalSteps]  = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentStep, setCurrentStep] = useState<Step | null>(null);
  const [mounted,     setMounted]     = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Build script when scene/transcript changes — auto-start immediately
  useEffect(() => {
    if (!scene) return;
    narratedStep.current = -1; // reset guard on new scene
    setStep(0);
    setCurrentStep(null);
    const script = SCRIPTS[scene](transcript);
    setTotalSteps(script.length);
    // Small delay so panel animation completes before narration starts
    const t = setTimeout(() => setIsPlaying(true), 800);
    return () => clearTimeout(t);
  }, [scene, transcript]);

  // Ref to track if we already narrated this step (prevent double-fire on re-render)
  const narratedStep = useRef(-1);

  // Auto-play narration for current step — advances ONLY after speech ends
  useEffect(() => {
    if (!scene || !isPlaying) return;
    const script = SCRIPTS[scene](transcript);
    if (step >= script.length) { setIsPlaying(false); return; }
    // Guard: don't re-narrate same step twice
    if (narratedStep.current === step) return;
    narratedStep.current = step;

    const s = script[step];
    setCurrentStep(s);

    // Advance step when speech finishes via onDone callback
    const advanceStep = () => {
      setStep(prev => prev === step ? prev + 1 : prev);
    };

    onNarrate(s.narration, advanceStep);

    // Fallback timer in case onDone never fires (e.g. TTS disabled or very long speech)
    const fallback = setTimeout(advanceStep, s.duration + 2000);
    return () => clearTimeout(fallback);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isPlaying, scene]);

  const startLesson = useCallback(() => {
    setStep(0);
    setIsPlaying(true);
  }, []);

  const handlePrev = () => {
    if (step > 0) { setStep(s => s - 1); setIsPlaying(false); }
  };

  const handleNext = () => {
    if (scene && step < SCRIPTS[scene](transcript).length - 1) { setStep(s => s + 1); }
  };

  if (!scene || !mounted) return null;

  // Determine animation step (subtract 1 for intro step)
  const animStep = Math.max(0, step - 1);

  const animalName = ["butterfly","frog","chicken","dog","cat"].find(a => transcript.toLowerCase().includes(a)) ?? "butterfly";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Panel */}
        <motion.div
          className="relative z-10 w-full max-w-2xl rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(15,15,30,0.97) 0%, rgba(20,10,40,0.97) 100%)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 0 80px rgba(99,102,241,0.3), 0 32px 64px rgba(0,0,0,0.6)",
            maxHeight: "90vh",
          }}
          initial={{ y: 80, scale: 0.9, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 60, scale: 0.92, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-white font-bold text-base">{SCENE_TITLES[scene]}</span>
              <span className="text-xs text-white/40 font-mono">{step + 1}/{totalSteps}</span>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>

          {/* Animation area */}
          <div className="relative h-72 sm:h-80 bg-black/30">
            {scene === "solar-system"   && <SolarSystem highlightPlanet={currentStep?.highlight} />}
            {scene === "photosynthesis" && <Photosynthesis step={animStep} />}
            {scene === "animal-life"    && <AnimalLife animal={animalName} step={animStep} />}
            {scene === "water-cycle"    && <WaterCycle step={animStep} />}

            {/* Explore mode badge */}
            <div className="absolute top-3 left-3 px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}>
              🔭 Explore Mode
            </div>
          </div>

          {/* Narration card */}
          <div className="px-5 py-4 border-t border-white/10">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                className="flex items-start gap-3 p-3 rounded-2xl"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #818CF8, #6366F1)" }}>
                  <span className="text-white text-xs font-bold">M</span>
                </div>
                <p className="text-white text-sm leading-relaxed font-medium flex-1">
                  {currentStep?.narration ?? "Tap ▶ Start to begin the lesson! 🚀"}
                </p>
                {isSpeaking && (
                  <div className="flex items-center gap-0.5 shrink-0 mt-1">
                    {[1,2,3,2,1].map((h, i) => (
                      <motion.div key={i} className="w-1 rounded-full bg-indigo-400"
                        animate={{ height: [h * 3, h * 8, h * 3] }}
                        transition={{ duration: 0.4, delay: i * 0.08, repeat: Infinity }} />
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="px-5 pb-5 flex items-center gap-3">
            {/* Prev */}
            <button onClick={handlePrev} disabled={step === 0}
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>

            {/* Play/Pause */}
            {!isPlaying ? (
              <motion.button
                onClick={startLesson}
                className="flex-1 h-10 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm text-white transition-all"
                style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)", boxShadow: "0 0 24px rgba(99,102,241,0.4)" }}
                whileTap={{ scale: 0.96 }}
              >
                ▶ {step === 0 ? "Start" : "Resume"}
              </motion.button>
            ) : (
              <motion.button
                onClick={() => setIsPlaying(false)}
                className="flex-1 h-10 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm text-white/80 transition-all"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                whileTap={{ scale: 0.96 }}
              >
                ⏸ Pause
              </motion.button>
            )}

            {/* Next */}
            <button onClick={handleNext} disabled={!scene || step >= SCRIPTS[scene](transcript).length - 1}
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #6366F1, #8B5CF6)" }}
              animate={{ width: `${totalSteps > 0 ? ((step + 1) / totalSteps) * 100 : 0}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
