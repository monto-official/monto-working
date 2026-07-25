"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Mic, RotateCcw, Sparkles, Star, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { transcribeAudio, APIError } from "@/lib/api";
import { extractSpokenNumber } from "@/lib/number-words";
import { MiniMonto } from "@/components/MiniMonto";
import type { Settings } from "@/types";

type Phase = "welcome" | "question" | "feedback" | "finished";
type Question = { a: number; b: number; answer: number };

const TOTAL_QUESTIONS = 5;
const LISTEN_MS = 5000;
// Nudges Whisper toward short numeric answers (0-20) instead of guessing at
// an unrelated language — single-word answers are otherwise easy to misread.
const NUMBER_ANSWER_PROMPT =
  "A child answering a simple math question by saying a single number " +
  "from zero to twenty, in Nepali, English, or Hindi. Examples: five, ten, " +
  "twelve, चार, दश, बीस, char, das, bees, chaudha, pandhra, 14, 15.";
const SETTINGS: Settings = { language: "nepali", voice: "female", autoSpeak: true, darkMode: true };
const PRAISE = ["एकदम सहि!", "वाह, ठिक भयो!", "सही जवाफ, तपाईं त होसियार हुनुहुँदो रहेछ!", "एकदम राम्रो!", "सुपर्ब!"];

function generateQuestions(count: number): Question[] {
  return Array.from({ length: count }, () => {
    const a = 1 + Math.floor(Math.random() * 9);
    const b = 1 + Math.floor(Math.random() * 9);
    return { a, b, answer: a + b };
  });
}

export default function MathQuizPage() {
  const router = useRouter();
  const { speak, cancel } = useTTS();
  const recorder = useAudioRecorder();

  const [questions, setQuestions] = useState<Question[]>(() => generateQuestions(TOTAL_QUESTIONS));
  const [phase, setPhase] = useState<Phase>("welcome");
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [heard, setHeard] = useState("");
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [message, setMessage] = useState("५ जोड्ने ५ कति हुन्छ? बोलेर भन त!");
  const [checking, setChecking] = useState(false);

  const speakingRef = useRef(false);
  const [speaking, setSpeaking] = useState(false);
  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = questions[index];
  const progress = useMemo(
    () => Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i < index || (i === index && phase === "finished")),
    [index, phase],
  );

  const say = useCallback((text: string, emotion = "excited") => {
    speakingRef.current = true;
    setSpeaking(true);
    void speak(text, emotion, SETTINGS, undefined, () => { speakingRef.current = false; setSpeaking(false); });
  }, [speak]);

  const clearListenTimer = () => {
    if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
    listenTimerRef.current = null;
  };
  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = null;
  };

  useEffect(() => () => {
    clearListenTimer();
    clearAdvanceTimer();
    recorder.cancelRecording();
    cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ask the question out loud whenever a new one comes up.
  useEffect(() => {
    if (phase !== "question" || !current) return;
    setHeard("");
    setLastCorrect(null);
    setMessage(`${current.a} + ${current.b} = ?`);
    say(`${current.a} जोड्ने ${current.b} कति हुन्छ?`, "curious");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index]);

  const evaluate = useCallback((spoken: number | null) => {
    const correct = spoken !== null && spoken === current.answer;
    setLastCorrect(correct);
    if (correct) setScore(s => s + 1);
    setPhase("feedback");

    if (correct) {
      const line = PRAISE[index % PRAISE.length];
      setMessage(line);
      say(`[happy]\n${line}`, "happy");
    } else {
      // Teach with a worked example — count up from `a`, one step per unit
      // of `b` — instead of just stating the answer, so the child can
      // actually follow how the sum was reached.
      const steps = Array.from({ length: current.b }, (_, i) => current.a + i + 1);
      const intro = spoken === null ? "सुनिएन! सुन है" : "त्यो होइन नि! सुन है";
      const line = `${intro}: ${current.a} पछि ${current.b} वटा गन्ने — ${steps.join(", ")}। त्यसैले ${current.a} जोड्ने ${current.b} बराबर ${current.answer} हुन्छ!`;
      setMessage(line);
      say(`[friendly]\n${line}`, "thinking");
    }

    clearAdvanceTimer();
    const proceed = () => {
      if (index + 1 >= questions.length) setPhase("finished");
      else { setIndex(i => i + 1); setPhase("question"); }
    };
    const wait = () => {
      if (speakingRef.current) { advanceTimerRef.current = setTimeout(wait, 200); return; }
      proceed();
    };
    advanceTimerRef.current = setTimeout(wait, 1400);
  }, [current, index, questions.length, say]);

  const finishListening = useCallback(async () => {
    clearListenTimer();
    const blob = await recorder.stopRecording();
    if (!blob || blob.size < 500) {
      setMessage("सुनिएन! माइक थिचेर फेरि भन्नुहोस् 😊");
      return;
    }
    setChecking(true);
    try {
      const transcript = await transcribeAudio(blob, NUMBER_ANSWER_PROMPT, "ne");
      setHeard(transcript);
      evaluate(extractSpokenNumber(transcript));
    } catch (err) {
      setMessage(err instanceof APIError ? err.message : "सुन्न सकिएन, फेरि प्रयास गर्नुहोस्!");
    } finally {
      setChecking(false);
    }
  }, [recorder, evaluate]);

  const startListening = useCallback(async () => {
    setHeard("");
    await recorder.startRecording();
    clearListenTimer();
    listenTimerRef.current = setTimeout(() => { void finishListening(); }, LISTEN_MS);
  }, [recorder, finishListening]);

  const begin = () => {
    setIndex(0);
    setScore(0);
    setPhase("question");
  };

  const restart = () => {
    clearListenTimer();
    clearAdvanceTimer();
    cancel();
    recorder.cancelRecording();
    setQuestions(generateQuestions(TOTAL_QUESTIONS));
    setIndex(0);
    setScore(0);
    setHeard("");
    setLastCorrect(null);
    setPhase("welcome");
    setMessage("५ जोड्ने ५ कति हुन्छ? बोलेर भन त!");
  };

  const isRecording = recorder.recordingState === "recording";
  const canAnswer = phase === "question" && !speaking && !isRecording && !checking;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#0b1020] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(99,102,241,.28),transparent_32%),radial-gradient(circle_at_85%_85%,rgba(236,72,153,.22),transparent_34%),linear-gradient(155deg,#0b1020,#181233)]" />
      {["🧮", "➕", "🔢", "⭐", "🎯", "✖️"].map((item, i) => (
        <motion.span key={i} className="absolute select-none text-3xl opacity-10" style={{ left: `${6 + (i * 31) % 90}%`, top: `${10 + (i * 37) % 78}%` }} animate={{ y: [0, -14, 0], rotate: [-6, 8, -6] }} transition={{ duration: 3 + i % 3, repeat: Infinity }}>{item}</motion.span>
      ))}

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/games")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Back"><ArrowLeft /></button>
            <button onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Close"><X /></button>
          </div>
          <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.28em] text-indigo-200/70">Monto</p><h1 className="font-kids text-xl font-black">Math Quiz</h1></div>
          <div className="flex h-11 items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 font-black text-amber-200"><Star className="h-4 w-4 fill-current" />{score}</div>
        </header>

        {phase !== "welcome" && (
          <div className="mx-auto mt-6 flex gap-2">
            {progress.map((done, i) => <div key={i} className={`h-2.5 w-9 rounded-full ${done ? "bg-indigo-400" : i === index ? "bg-white/40" : "bg-white/10"}`} />)}
          </div>
        )}

        <section className="flex flex-1 flex-col items-center justify-center py-5 text-center">
          <AnimatePresence mode="wait">
            <motion.div key={phase + index} initial={{ opacity: 0, scale: .88, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.08 }} className="w-full">
              <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-[3.5rem] border border-white/10 bg-white/10 shadow-[0_30px_80px_rgba(0,0,0,.3)] sm:h-56 sm:w-56">
                {phase === "welcome" && <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="text-8xl">🧮</motion.div>}
                {phase === "question" && !isRecording && !checking && (
                  <p className="font-kids text-4xl font-black sm:text-5xl">{current.a} + {current.b}</p>
                )}
                {phase === "question" && isRecording && <motion.div animate={{ scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: .7 }}><Mic className="mx-auto h-20 w-20 text-rose-300" /></motion.div>}
                {phase === "question" && checking && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="text-6xl">⏳</motion.div>}
                {phase === "feedback" && lastCorrect && <motion.div animate={{ rotate: [-8, 8, 0], scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: .7 }} className="text-8xl">🌟</motion.div>}
                {phase === "feedback" && !lastCorrect && <motion.div animate={{ rotate: [-6, 6, -6] }} transition={{ repeat: Infinity, duration: .6 }} className="text-8xl">🤔</motion.div>}
                {phase === "finished" && <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="text-8xl">🏆</motion.div>}
              </div>

              <p className="mt-7 text-xs font-black uppercase tracking-[.28em] text-indigo-200/65">
                {phase === "question" ? (isRecording ? "Listening…" : checking ? "Thinking…" : "Say your answer") : phase === "finished" ? `${score} / ${questions.length}` : "Math Quiz"}
              </p>
              <h2 className="mx-auto mt-3 flex max-w-xl items-center justify-center gap-2 text-2xl font-black leading-tight sm:text-4xl">
                {phase === "feedback" && (lastCorrect ? <Check className="h-7 w-7 text-emerald-300" /> : <XCircle className="h-7 w-7 text-rose-300" />)}
                {phase === "finished" ? `तपाईंले ${score} मा ${questions.length} सही जवाफ दिनुभयो!` : message}
              </h2>
              {heard && phase !== "welcome" && phase !== "finished" && <p className="mt-3 text-sm text-white/45">I heard: “{heard}”</p>}
            </motion.div>
          </AnimatePresence>
        </section>

        <div className="mx-auto w-full max-w-md pb-3">
          {phase === "welcome" && <motion.button whileTap={{ scale: .96 }} onClick={begin} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-indigo-400 to-fuchsia-400 text-lg font-black text-slate-950 shadow-xl"><Sparkles /> Start quiz</motion.button>}
          {phase === "question" && canAnswer && <motion.button whileTap={{ scale: .96 }} onClick={startListening} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-white text-lg font-black text-slate-950 shadow-xl"><Mic /> Tap to answer</motion.button>}
          {phase === "question" && isRecording && <motion.button whileTap={{ scale: .96 }} onClick={finishListening} className="flex h-14 w-full items-center justify-center gap-2 rounded-3xl bg-rose-500 font-black text-white">Done — check my answer</motion.button>}
          {phase === "question" && (speaking || checking) && !isRecording && <div className="h-14 text-center font-black text-white/40">{checking ? "Checking your answer…" : "Monto is asking…"}</div>}
          {phase === "feedback" && <div className={`h-14 text-center font-black ${lastCorrect ? "text-emerald-300" : "text-amber-200"}`}>{lastCorrect ? "Correct! ⭐" : "Let's learn it! 💡"}</div>}
          {phase === "finished" && <motion.button whileTap={{ scale: .96 }} onClick={restart} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-amber-300 to-orange-400 text-lg font-black text-slate-950"><RotateCcw /> Play again</motion.button>}
        </div>
      </div>
      <MiniMonto speaking={speaking} />
    </main>
  );
}
