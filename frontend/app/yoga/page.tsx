"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Pause, Play, RotateCcw, ShieldCheck, Star, Trophy, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";
import type { Settings } from "@/types";

type Phase = "welcome" | "countdown" | "exercise" | "rest" | "finished";
type Exercise = {
  id: string;
  nepali: string;
  english: string;
  emoji: string;
  duration: number;
  instruction: string;
  encouragement: string;
  color: string;
  animation: "march" | "reach" | "bend" | "jump" | "knee" | "touch" | "balance" | "breathe";
};

const EXERCISES: Exercise[] = [
  { id: "march", nepali: "ठाउँमै मार्च", english: "March in place", emoji: "🚶", duration: 15, instruction: "ढाड सीधा राखेर पालैपालो घुँडा उठाऔँ। हात पनि अगाडि–पछाडि चलाऔँ।", encouragement: "वाह! घुँडा अलि माथि उठाऔँ!", color: "#38BDF8", animation: "march" },
  { id: "reach", nepali: "आकाश छुने", english: "Reach for the sky", emoji: "🙆", duration: 12, instruction: "दुवै हात माथि तन्काएर आकाश छुने प्रयास गरौँ। फेरि हात तल ल्याऔँ।", encouragement: "एकदम राम्रो! अझ अग्लो बनौँ!", color: "#A78BFA", animation: "reach" },
  { id: "bend", nepali: "दायाँ–बायाँ झुक्ने", english: "Side bends", emoji: "🤸", duration: 14, instruction: "खुट्टा अलि फराकिलो राखौँ। बिस्तारै दायाँ र बायाँतिर झुकौँ।", encouragement: "बिस्तारै गरौँ, हतार गर्नु पर्दैन!", color: "#34D399", animation: "bend" },
  { id: "jump", nepali: "जम्पिङ स्टार", english: "Jumping stars", emoji: "⭐", duration: 15, instruction: "उफ्रँदा हात र खुट्टा खोलौँ, फेरि सँगै ल्याऔँ। आफ्नो वरिपरि खाली ठाउँ राखौँ।", encouragement: "सुपर स्टार! लय मिलाएर उफ्रौँ!", color: "#FB7185", animation: "jump" },
  { id: "knee", nepali: "घुँडा उठाउने", english: "High knees", emoji: "🦵", duration: 15, instruction: "पालैपालो घुँडा कम्मरसम्म उठाऔँ। सन्तुलनका लागि हात चलाऔँ।", encouragement: "दमदार! अब अर्को घुँडा!", color: "#F59E0B", animation: "knee" },
  { id: "touch", nepali: "खुट्टाको औँला छुने", english: "Toe touches", emoji: "🙇", duration: 12, instruction: "घुँडा धेरै नबंग्याई बिस्तारै तल झुकौँ र खुट्टाको औँला छुने प्रयास गरौँ।", encouragement: "जति पुग्छ त्यति मात्रै, बल नगर्नू!", color: "#22C55E", animation: "touch" },
  { id: "balance", nepali: "रुखजस्तै सन्तुलन", english: "Tree balance", emoji: "🌳", duration: 12, instruction: "एउटा खुट्टामा उभिऔँ। गाह्रो भए भित्ता वा कुर्सी समात्न सक्छौँ।", encouragement: "शाबास! तिमी बलियो रुखजस्तै छौ!", color: "#10B981", animation: "balance" },
  { id: "breathe", nepali: "शान्त सास", english: "Calm breathing", emoji: "🧘", duration: 15, instruction: "नाकबाट बिस्तारै सास लिऔँ, पेट फुलाऔँ, अनि मुखबाट सास छोडौँ।", encouragement: "सुन्दर! शरीरलाई शान्त हुन दिऔँ।", color: "#818CF8", animation: "breathe" },
];

const SETTINGS: Settings = { language: "nepali", voice: "female", autoSpeak: true, darkMode: true };

export default function YogaPage() {
  const router = useRouter();
  const { speak, cancel } = useTTS();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(3);
  const [stars, setStars] = useState(0);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [message, setMessage] = useState("रमाइलो गर्दै शरीर चलाउन तयार छौ?");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exercise = EXERCISES[index];

  const progress = useMemo(() => Math.round(((index + (phase === "finished" ? 1 : 0)) / EXERCISES.length) * 100), [index, phase]);
  const say = useCallback((text: string, emotion = "excited") => {
    if (soundOn) void speak(text, emotion, SETTINGS);
  }, [soundOn, speak]);

  const clearClock = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  useEffect(() => () => {
    clearClock();
    cancel();
  }, [cancel, clearClock]);

  const beginCountdown = useCallback((nextIndex = index) => {
    clearClock();
    setIndex(nextIndex);
    setPaused(false);
    setRemaining(3);
    setPhase("countdown");
    setMessage("तयार होऊ…");
    const next = EXERCISES[nextIndex];
    say(`[excited]\nअब ${next.nepali}। तयार होऊ! तीन, दुई, एक!`, "excited");
  }, [clearClock, index, say]);

  const startExercise = useCallback(() => {
    setRemaining(exercise.duration);
    setPhase("exercise");
    setMessage(exercise.instruction);
    say(`[friendly]\n${exercise.nepali}। ${exercise.instruction}`, "happy");
  }, [exercise, say]);

  const completeExercise = useCallback(() => {
    const isLast = index >= EXERCISES.length - 1;
    setStars(value => value + 1);
    if (isLast) {
      setPhase("finished");
      setMessage("आजको बाल PT पूरा भयो!");
      say("[excited]\nवाह! आजको सबै व्यायाम पूरा भयो। तिमी साँच्चै फिटनेस सुपरस्टार हौ!", "excited");
    } else {
      setRemaining(5);
      setPhase("rest");
      setMessage("पानीको एक सानो घुट्को लिन सक्छौ।");
      say(`[happy]\nशाबास! एउटा तारा पायौ। अब पाँच सेकेन्ड आराम गरौँ।`, "happy");
    }
  }, [index, say]);

  useEffect(() => {
    clearClock();
    if (paused || phase === "welcome" || phase === "finished") return;

    intervalRef.current = setInterval(() => {
      setRemaining(value => {
        if (value > 1) return value - 1;
        clearClock();
        if (phase === "countdown") startExercise();
        else if (phase === "exercise") completeExercise();
        else if (phase === "rest") beginCountdown(index + 1);
        return 0;
      });
    }, 1000);
    return clearClock;
  }, [beginCountdown, clearClock, completeExercise, index, paused, phase, startExercise]);

  useEffect(() => {
    if (phase !== "exercise" || remaining !== Math.ceil(exercise.duration / 2)) return;
    say(`[excited]\n${exercise.encouragement}`, "excited");
  }, [exercise, phase, remaining, say]);

  // Fully touchless: no tap needed to begin — Monto talks it through and
  // auto-starts the countdown so kids don't have to stop moving to press a button.
  useEffect(() => {
    if (phase !== "welcome") return;
    say("[excited]\nरमाइलो गर्दै शरीर चलाऔँ! तयार होऊ!", "excited");
    const t = setTimeout(() => beginCountdown(0), 3500);
    return () => clearTimeout(t);
  }, [phase, say, beginCountdown]);

  // ...and no tap needed to leave — auto-return home once the celebration plays out.
  useEffect(() => {
    if (phase !== "finished") return;
    const t = setTimeout(() => { cancel(); router.push("/"); }, 6000);
    return () => clearTimeout(t);
  }, [phase, cancel, router]);

  const skip = () => {
    if (phase === "finished") return;
    if (index >= EXERCISES.length - 1) {
      setPhase("finished");
      setMessage("आजको बाल PT पूरा भयो!");
      return;
    }
    beginCountdown(index + 1);
  };

  const restart = () => {
    clearClock();
    cancel();
    setIndex(0);
    setStars(0);
    setRemaining(3);
    setPaused(false);
    setPhase("welcome");
    setMessage("रमाइलो गर्दै शरीर चलाउन तयार छौ?");
  };

  const leave = () => {
    clearClock();
    cancel();
    router.push("/");
  };

  const motionAnimation = phase === "exercise" && !paused ? {
    march: { y: [0, -18, 0, -18, 0], rotate: [-3, 3, -3] },
    reach: { scaleY: [1, 1.18, 1], y: [0, -14, 0] },
    bend: { rotate: [-15, 15, -15] },
    jump: { y: [0, -28, 0], scale: [1, 1.12, 1] },
    knee: { y: [0, -16, 0, -16, 0], rotate: [-6, 6, -6] },
    touch: { rotate: [0, 18, 0], y: [0, 12, 0] },
    balance: { rotate: [-3, 3, -3] },
    breathe: { scale: [1, 1.16, 1] },
  }[exercise.animation] : {};

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#071421] text-white select-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(34,197,94,.22),transparent_32%),radial-gradient(circle_at_88%_82%,rgba(59,130,246,.25),transparent_34%),linear-gradient(155deg,#071421,#0d2137_50%,#141737)]" />
      {["🌿", "⭐", "💪", "🌈", "⚡", "🏃"].map((item, i) => <motion.span key={i} className="absolute select-none text-3xl opacity-10" style={{ left: `${7 + i * 18}%`, top: `${12 + (i * 31) % 75}%` }} animate={{ y: [0, -14, 0], rotate: [-5, 8, -5] }} transition={{ duration: 3 + i * .35, repeat: Infinity }}>{item}</motion.span>)}

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <button onClick={leave} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="पछाडि"><ArrowLeft /></button>
          <div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.3em] text-emerald-200/65">Monto नेपाली Coach</p><h1 className="font-kids text-xl font-black">बाल PT Exercise</h1></div>
          <button onClick={() => { setSoundOn(value => !value); if (soundOn) cancel(); }} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="आवाज">{soundOn ? <Volume2 /> : <VolumeX />}</button>
        </header>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" animate={{ width: `${progress}%` }} /></div>
          <div className="flex items-center gap-1 text-sm font-black text-amber-200"><Star className="h-4 w-4 fill-current" />{stars}</div>
        </div>

        <section className="flex flex-1 flex-col items-center justify-center py-5 text-center">
          <AnimatePresence mode="wait">
            <motion.div key={`${phase}-${index}`} initial={{ opacity: 0, scale: .88, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.08 }} className="w-full">
              <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-[4rem] border border-white/10 bg-white/10 shadow-[0_30px_85px_rgba(0,0,0,.32)] sm:h-60 sm:w-60" style={{ boxShadow: `0 25px 80px ${exercise.color}30` }}>
                {phase === "welcome" && <motion.div animate={{ y: [0, -12, 0], rotate: [-4, 4, -4] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-8xl">🏃</motion.div>}
                {phase === "countdown" && <motion.div key={remaining} initial={{ scale: 1.7, opacity: .3 }} animate={{ scale: 1, opacity: 1 }} className="text-8xl font-black" style={{ color: exercise.color }}>{remaining}</motion.div>}
                {phase === "exercise" && <motion.div animate={motionAnimation} transition={{ duration: exercise.animation === "breathe" ? 3 : 1, repeat: Infinity, ease: "easeInOut" }} className="text-8xl">{exercise.emoji}</motion.div>}
                {phase === "rest" && <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }} className="text-8xl">💧</motion.div>}
                {phase === "finished" && <motion.div animate={{ y: [0, -10, 0], rotate: [-5, 5, -5] }} transition={{ duration: 1, repeat: Infinity }}><Trophy className="h-28 w-28 text-amber-300" /></motion.div>}
              </div>

              <p className="mt-6 text-xs font-black uppercase tracking-[.28em]" style={{ color: exercise.color }}>{phase === "welcome" ? "८ रमाइला exercise" : phase === "rest" ? "आराम" : phase === "finished" ? "पूरा भयो" : `${index + 1} / ${EXERCISES.length} · ${exercise.english}`}</p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">{phase === "welcome" ? "Monto सँग चलौँ!" : phase === "rest" ? "आराम गरौँ" : phase === "finished" ? "फिटनेस सुपरस्टार!" : exercise.nepali}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">{message}</p>
              {(phase === "exercise" || phase === "rest" || phase === "countdown") && <motion.div key={remaining} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="mt-5 text-5xl font-black tabular-nums">{remaining}<span className="ml-1 text-sm text-white/35">सेकेन्ड</span></motion.div>}
            </motion.div>
          </AnimatePresence>
        </section>

        <div className="mx-auto w-full max-w-lg pb-3">
          {phase === "welcome" ? <motion.button whileTap={{ scale: .96 }} onClick={() => beginCountdown(0)} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-lg font-black text-slate-950 shadow-[0_18px_45px_rgba(52,211,153,.25)]"><Play className="fill-current" /> सुरु गरौँ</motion.button>
          : phase === "finished" ? <motion.button whileTap={{ scale: .96 }} onClick={restart} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-amber-300 to-orange-400 text-lg font-black text-slate-950"><RotateCcw /> फेरि खेलौँ</motion.button>
          : <div className="grid grid-cols-[1fr_1.5fr_1fr] gap-3">
              <button onClick={restart} className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[.06] text-xs font-bold text-white/55"><RotateCcw className="mr-1 h-4 w-4" />Reset</button>
              <motion.button whileTap={{ scale: .95 }} onClick={() => setPaused(value => !value)} className="flex h-14 items-center justify-center gap-2 rounded-2xl font-black text-slate-950" style={{ background: exercise.color }}>{paused ? <Play className="fill-current" /> : <Pause />}{paused ? "जारी राखौँ" : "रोकौँ"}</motion.button>
              <button onClick={skip} className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[.06] text-xs font-bold text-white/55">अर्को <ChevronRight className="h-4 w-4" /></button>
            </div>}
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.06] px-3 py-2.5 text-left text-[11px] leading-relaxed text-emerald-50/50"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><span>वरिपरि खाली ठाउँ राख। दुख्यो वा चक्कर आयो भने तुरुन्त रोक र ठूलो मान्छेलाई भन।</span></div>
        </div>
      </div>
    </main>
  );
}
