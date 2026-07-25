"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw, Star, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";
import type { Settings } from "@/types";

type Phase = "welcome" | "countdown" | "exercise" | "rest" | "finished";
type Exercise = {
  id: string;
  nepali: string;
  duration: number;
  instruction: string;
  encouragement: string;
  color: string;
  gif: string;
};

const EXERCISES: Exercise[] = [
  { id: "hands", nepali: "हात तल-माथि", duration: 15, instruction: "दुवै हात तल राखौँ। अब बिस्तारै काँधमाथि उठाऔँ र फेरि तल ल्याऔँ।", encouragement: "राम्रो! हात बिस्तारै तल र माथि गरौँ।", color: "#38BDF8", gif: "/pt/1.gif" },
  { id: "shoulders", nepali: "काँध माथि-तल", duration: 15, instruction: "हात शरीरको छेउमा राखौँ। दुवै काँध कानतिर माथि उठाऔँ र बिस्तारै तल झारौँ।", encouragement: "शाबास! काँध माथि, अनि तल।", color: "#2DD4BF", gif: "/pt/2.gif" },
  { id: "arms", nepali: "हात अगाडि-पछाडि", duration: 15, instruction: "दुवै हातलाई बिस्तारै अगाडि उठाऔँ, फेरि शरीरको छेउमा तल ल्याऔँ।", encouragement: "एकदम राम्रो! हात सीधा राखौँ।", color: "#A78BFA", gif: "/pt/3.gif" },
  { id: "open", nepali: "दुवै हात फैलाउने", duration: 15, instruction: "दुवै हात काँधको उचाइमा छेउतिर फैलाऔँ र फेरि तल ल्याऔँ।", encouragement: "राम्रो गर्दै हुनुहुन्छ! बिस्तारै गरौँ।", color: "#34D399", gif: "/pt/4.gif" },
];

const PT_GIFS = ["/pt/1.gif", "/pt/2.gif", "/pt/3.gif", "/pt/4.gif"];

const SETTINGS: Settings = { language: "nepali", voice: "female", autoSpeak: true, darkMode: true };

export default function YogaPage() {
  const router = useRouter();
  const { speak, cancel } = useTTS();
  const [phase, setPhase] = useState<Phase>("exercise");
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(EXERCISES[0].duration);
  const [stars, setStars] = useState(0);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [message, setMessage] = useState(EXERCISES[0].instruction);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exercise = EXERCISES[index];
  const [displayedGif, setDisplayedGif] = useState(PT_GIFS[0]);

  const progress = useMemo(() => Math.round(((index + (phase === "finished" ? 1 : 0)) / EXERCISES.length) * 100), [index, phase]);
  const speakingRef = useRef(false);
  const say = useCallback((text: string, emotion = "excited") => {
    if (!soundOn) return;
    speakingRef.current = true;
    void speak(text, emotion, SETTINGS, undefined, () => { speakingRef.current = false; });
  }, [soundOn, speak]);

  useEffect(() => {
    setDisplayedGif(current => {
      const choices = PT_GIFS.filter(gif => gif !== current);
      return choices[Math.floor(Math.random() * choices.length)];
    });
  }, [index]);

  const initialVoiceRef = useRef(false);
  useEffect(() => {
    if (initialVoiceRef.current || phase !== "exercise") return;
    initialVoiceRef.current = true;
    say(`[friendly]\n${exercise.nepali}। ${exercise.instruction}`, "happy");
  }, [exercise, phase, say]);
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
      say("[excited]\nवाह! आजको सबै व्यायाम पूरा भयो। तपाईं साँच्चै फिटनेस सुपरस्टार हुनुहुन्छ!", "excited");
    } else {
      setRemaining(5);
      setPhase("rest");
      setMessage("पानीको एक सानो घुट्को लिन सक्नुहुन्छ।");
      say(`[happy]\nशाबास! तपाईंले एउटा तारा पाउनुभयो। अब पाँच सेकेन्ड आराम गरौँ।`, "happy");
    }
  }, [index, say]);

  useEffect(() => {
    clearClock();
    if (paused || phase === "welcome" || phase === "finished") return;

    intervalRef.current = setInterval(() => {
      setRemaining(value => {
        if (value > 1) return value - 1;
        // Hold here until Monto finishes talking — never cut a sentence short.
        if (speakingRef.current) return value;
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
    say("[excited]\nरमाइलो गर्दै शरीर चलाऔँ! तयार हुनुहोस्!", "excited");
    let cancelled = false;
    const tryAdvance = () => {
      if (cancelled) return;
      if (speakingRef.current) { setTimeout(tryAdvance, 200); return; }
      beginCountdown(0);
    };
    const t = setTimeout(tryAdvance, 3500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [phase, say, beginCountdown]);

  // ...and no tap needed to leave — auto-return home once the celebration plays out.
  useEffect(() => {
    if (phase !== "finished") return;
    let cancelled = false;
    const tryLeave = () => {
      if (cancelled) return;
      if (speakingRef.current) { setTimeout(tryLeave, 200); return; }
      cancel();
      router.push("/");
    };
    const t = setTimeout(tryLeave, 6000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [phase, cancel, router]);

  const restart = () => {
    clearClock();
    cancel();
    setIndex(0);
    setStars(0);
    setRemaining(EXERCISES[0].duration);
    setPaused(false);
    setPhase("exercise");
    setMessage("रमाइलो गर्दै शरीर चलाउन तयार हुनुहुन्छ?");
  };

  const leave = () => {
    clearClock();
    cancel();
    router.push("/");
  };

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#071421] text-white select-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(34,197,94,.22),transparent_32%),radial-gradient(circle_at_88%_82%,rgba(59,130,246,.25),transparent_34%),linear-gradient(155deg,#071421,#0d2137_50%,#141737)]" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <button onClick={leave} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="बन्द गर्नुहोस्"><X /></button>
          <div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.3em] text-emerald-200/65">Monto नेपाली प्रशिक्षक</p><h1 className="font-kids text-xl font-black">बाल व्यायाम</h1></div>
          <button onClick={() => { setSoundOn(value => !value); if (soundOn) cancel(); }} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="आवाज">{soundOn ? <Volume2 /> : <VolumeX />}</button>
        </header>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" animate={{ width: `${progress}%` }} /></div>
          <div className="flex items-center gap-1 text-sm font-black text-amber-200"><Star className="h-4 w-4 fill-current" />{stars}</div>
        </div>

        <section className="flex flex-1 flex-col items-center justify-center py-5 text-center">
          <AnimatePresence mode="wait">
            <motion.div key={`${phase}-${index}`} initial={{ opacity: 0, scale: .88, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.08 }} className="w-full">
              <div className="relative mx-auto flex h-64 w-full max-w-md items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-[0_30px_85px_rgba(0,0,0,.32)]" style={{ boxShadow: `0 25px 80px ${exercise.color}30` }}>
                {phase === "welcome" && <img src="/pt/1.gif" alt="Monto PT warm-up" className="h-full w-full object-contain" />}
                {phase === "countdown" && <motion.div key={remaining} initial={{ scale: 1.7, opacity: .3 }} animate={{ scale: 1, opacity: 1 }} className="text-8xl font-black" style={{ color: exercise.color }}>{remaining}</motion.div>}
                {phase === "exercise" && <img src={displayedGif} alt={`Monto ले ${exercise.nepali} देखाउँदै`} className="h-full w-full object-contain" />}
                {phase === "rest" && <img src="/pt/rest.gif" alt="Monto resting" className="h-full w-full object-contain" />}
                {phase === "finished" && <motion.div animate={{ y: [0, -10, 0], rotate: [-5, 5, -5] }} transition={{ duration: 1, repeat: Infinity }}><Trophy className="h-28 w-28 text-amber-300" /></motion.div>}
              </div>

              <p className="mt-6 text-xs font-black uppercase tracking-[.28em]" style={{ color: exercise.color }}>{phase === "welcome" ? "४ रमाइला व्यायाम" : phase === "rest" ? "आराम" : phase === "finished" ? "पूरा भयो" : `${index + 1} / ${EXERCISES.length}`}</p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">{phase === "welcome" ? "Monto सँग चलौँ!" : phase === "rest" ? "आराम गरौँ" : phase === "finished" ? "फिटनेस सुपरस्टार!" : exercise.nepali}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">{message}</p>
              {(phase === "exercise" || phase === "rest" || phase === "countdown") && <motion.div key={remaining} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="mt-5 text-5xl font-black tabular-nums">{remaining}<span className="ml-1 text-sm text-white/35">सेकेन्ड</span></motion.div>}
            </motion.div>
          </AnimatePresence>
        </section>

        <div className="mx-auto w-full max-w-lg pb-3">
          {phase === "welcome" ? <motion.button whileTap={{ scale: .96 }} onClick={() => beginCountdown(0)} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-lg font-black text-slate-950 shadow-[0_18px_45px_rgba(52,211,153,.25)]"><Play className="fill-current" /> सुरु गरौँ</motion.button>
          : phase === "finished" ? <motion.button whileTap={{ scale: .96 }} onClick={restart} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-amber-300 to-orange-400 text-lg font-black text-slate-950"><RotateCcw /> फेरि गरौँ</motion.button>
          : <motion.button whileTap={{ scale: .95 }} onClick={() => setPaused(value => !value)} className="mx-auto flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-2xl font-black text-slate-950" style={{ background: exercise.color }}>{paused ? <Play className="fill-current" /> : <Pause />}{paused ? "जारी राखौँ" : "रोकौँ"}</motion.button>}
        </div>
      </div>
    </main>
  );
}
