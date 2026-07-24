"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Mic, MicOff, RotateCcw, Sparkles, Star, Volume2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";
import { MiniMonto } from "@/components/MiniMonto";
import type { Settings } from "@/types";

type Animal = { id: string; name: string; emoji: string; sound: string; color: string; aliases: string[] };
type Phase = "welcome" | "choose" | "imitate" | "celebrate" | "finished";

const ANIMALS: Animal[] = [
  { id: "cow", name: "Cow", emoji: "🐄", sound: "Moo", color: "#F59E0B", aliases: ["cow", "गाई", "gai"] },
  { id: "dog", name: "Dog", emoji: "🐕", sound: "Woof woof", color: "#38BDF8", aliases: ["dog", "कुकुर", "kukur"] },
  { id: "cat", name: "Cat", emoji: "🐈", sound: "Meow", color: "#A78BFA", aliases: ["cat", "बिरालो", "biralo"] },
  { id: "lion", name: "Lion", emoji: "🦁", sound: "Roar", color: "#FB7185", aliases: ["lion", "सिंह", "singha"] },
  { id: "duck", name: "Duck", emoji: "🦆", sound: "Quack quack", color: "#22C55E", aliases: ["duck", "हाँस", "haas"] },
  { id: "sheep", name: "Sheep", emoji: "🐑", sound: "Baa", color: "#F472B6", aliases: ["sheep", "भेडा", "bheda"] },
  { id: "horse", name: "Horse", emoji: "🐎", sound: "Neigh", color: "#F97316", aliases: ["horse", "घोडा", "ghoda"] },
  { id: "frog", name: "Frog", emoji: "🐸", sound: "Ribbit", color: "#34D399", aliases: ["frog", "भ्यागुता", "bhyaguta"] },
  { id: "owl", name: "Owl", emoji: "🦉", sound: "Hoot hoot", color: "#818CF8", aliases: ["owl", "लाटोकोसेरो", "latokosero"] },
  { id: "elephant", name: "Elephant", emoji: "🐘", sound: "Trumpet", color: "#60A5FA", aliases: ["elephant", "हात्ती", "hatti"] },
];

const SETTINGS: Settings = { language: "english", voice: "female", autoSpeak: true, darkMode: true };
const PRAISE = ["Fantastic sound!", "That was amazing!", "You sound just like it!", "Brilliant imitation!", "Super listening!"];

export default function SoundChallengePage() {
  const router = useRouter();
  const { speak, cancel } = useTTS();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [chosen, setChosen] = useState<Animal[]>([]);
  const [current, setCurrent] = useState<Animal | null>(null);
  const [message, setMessage] = useState("Can you name five animals that make sounds?");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remaining = 5 - chosen.length;
  const progress = useMemo(() => Array.from({ length: 5 }, (_, index) => index < chosen.length), [chosen.length]);
  const speakingRef = useRef(false);
  const [speaking, setSpeaking] = useState(false);
  const say = useCallback((text: string, emotion = "excited") => {
    speakingRef.current = true;
    setSpeaking(true);
    void speak(text, emotion, SETTINGS, undefined, () => { speakingRef.current = false; setSpeaking(false); });
  }, [speak]);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => () => {
    clearTimer();
    recognitionRef.current?.stop();
    cancel();
  }, [cancel]);

  const begin = () => {
    setPhase("choose");
    setMessage("Name your first animal!");
    say("[excited]\nName five animals that make sounds. Tell me your first animal!", "excited");
  };

  const selectAnimal = useCallback((animal: Animal) => {
    if (chosen.some(item => item.id === animal.id)) {
      setMessage(`${animal.name} is already on your list. Choose a different animal!`);
      say(`[friendly]\nYou already named ${animal.name}. Can you name a different animal?`, "neutral");
      return;
    }
    setCurrent(animal);
    setHeard(animal.name);
    setPhase("imitate");
    setMessage(`What sound does a ${animal.name.toLowerCase()} make?`);
    say(`[curious]\nWhat sound does a ${animal.name.toLowerCase()} make?`, "thinking");
  }, [chosen, say]);

  const markImitated = () => {
    if (!current) return;
    const next = [...chosen, current];
    const praise = PRAISE[chosen.length % PRAISE.length];
    setChosen(next);
    setPhase("celebrate");
    setMessage(praise);
    say(`[happy]\n${praise} ${current.name} says ${current.sound}!`, "happy");
    clearTimer();
    const proceed = () => {
      if (next.length >= 5) {
        setPhase("finished");
        setMessage("You are a Sound Superstar!");
        say("[excited]\nWonderful! You named five animals and made all their sounds. You are a Sound Superstar!", "excited");
      } else {
        setCurrent(null);
        setHeard("");
        setPhase("choose");
        setMessage(`Great! Name animal number ${next.length + 1}.`);
        say(`[friendly]\nNow name animal number ${next.length + 1}.`, "neutral");
      }
    };
    // Give the praise line at least a moment to breathe, then wait for it to
    // actually finish talking before moving on — never cut it off mid-sentence.
    const wait = () => {
      if (speakingRef.current) { timerRef.current = setTimeout(wait, 200); return; }
      proceed();
    };
    timerRef.current = setTimeout(wait, 1800);
  };

  const startListening = () => {
    const SpeechRecognition = (window as typeof window & { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage("Voice recognition isn't available here—tap an animal below.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setMessage("I couldn't hear that. Try again or tap an animal!");
    };
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript ?? "").toLowerCase().trim();
      setHeard(transcript);
      const animal = ANIMALS.find(item => item.aliases.some(alias => transcript.includes(alias.toLowerCase())));
      if (animal) selectAnimal(animal);
      else {
        setMessage(`I heard “${transcript}”. Try another animal or tap one below.`);
        say("[friendly]\nI didn't recognize that animal. Please try again!", "neutral");
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const restart = () => {
    clearTimer();
    cancel();
    setChosen([]);
    setCurrent(null);
    setHeard("");
    setListening(false);
    setPhase("welcome");
    setMessage("Can you name five animals that make sounds?");
  };

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#081426] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,197,94,.25),transparent_30%),radial-gradient(circle_at_85%_85%,rgba(59,130,246,.28),transparent_34%),linear-gradient(155deg,#071421,#13203e)]" />
      {ANIMALS.slice(0, 8).map((animal, index) => <motion.span key={animal.id} className="absolute select-none text-3xl opacity-10" style={{ left: `${5 + (index * 29) % 90}%`, top: `${10 + (index * 41) % 80}%` }} animate={{ y: [0, -14, 0], rotate: [-5, 7, -5] }} transition={{ duration: 3 + index % 3, repeat: Infinity }}>{animal.emoji}</motion.span>)}

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Back"><ArrowLeft /></button>
            <button onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Close"><X /></button>
          </div>
          <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.28em] text-emerald-200/70">Monto</p><h1 className="font-kids text-xl font-black">Sound Challenge</h1></div>
          <div className="flex h-11 items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 font-black text-amber-200"><Star className="h-4 w-4 fill-current" />{chosen.length}</div>
        </header>

        <div className="mx-auto mt-6 flex gap-2">
          {progress.map((done, index) => <motion.div key={index} animate={done ? { scale: [1, 1.25, 1] } : {}} className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black ${done ? "border-emerald-300 bg-emerald-400 text-emerald-950" : "border-white/15 bg-white/5 text-white/35"}`}>{done ? <Check className="h-4 w-4" /> : index + 1}</motion.div>)}
        </div>

        <section className="flex flex-1 flex-col items-center justify-center py-5 text-center">
          <AnimatePresence mode="wait">
            <motion.div key={phase + (current?.id ?? chosen.length)} initial={{ opacity: 0, scale: .88, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.08 }} className="w-full">
              <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-[3.5rem] border border-white/10 bg-white/10 shadow-[0_30px_80px_rgba(0,0,0,.3)] sm:h-56 sm:w-56">
                {phase === "welcome" && <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="text-8xl">🎙️</motion.div>}
                {phase === "choose" && <div><motion.div animate={listening ? { scale: [1, 1.25, 1] } : {}} transition={{ repeat: Infinity, duration: .7 }}><Mic className={`mx-auto h-20 w-20 ${listening ? "text-rose-300" : "text-emerald-300"}`} /></motion.div><p className="mt-3 text-sm font-bold text-white/55">{listening ? "Listening…" : `${remaining} animal${remaining === 1 ? "" : "s"} left`}</p></div>}
                {phase === "imitate" && current && <motion.div animate={{ rotate: [-5, 5, -5], scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-8xl">{current.emoji}</motion.div>}
                {phase === "celebrate" && <motion.div animate={{ rotate: [-8, 8, 0], scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: .7 }} className="text-8xl">🌟</motion.div>}
                {phase === "finished" && <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="text-8xl">🏆</motion.div>}
              </div>
              <p className="mt-7 text-xs font-black uppercase tracking-[.28em] text-emerald-200/65">{phase === "imitate" ? `${current?.emoji} Your turn` : phase === "finished" ? "5 out of 5" : "Listen · Think · Imitate"}</p>
              <h2 className="mx-auto mt-3 max-w-xl text-2xl font-black leading-tight sm:text-4xl">{message}</h2>
              {heard && phase === "choose" && <p className="mt-3 text-sm text-white/45">I heard: {heard}</p>}
              {phase === "imitate" && current && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-lg font-black" style={{ color: current.color }}>Try it: “{current.sound}!”</motion.p>}
            </motion.div>
          </AnimatePresence>

          {phase === "choose" && <div className="mt-6 grid w-full max-w-xl grid-cols-5 gap-2">{ANIMALS.map(animal => {
            const used = chosen.some(item => item.id === animal.id);
            return <motion.button key={animal.id} whileTap={{ scale: .9 }} disabled={used} onClick={() => selectAnimal(animal)} className={`rounded-2xl border p-2 transition ${used ? "border-white/5 bg-white/[.02] opacity-25" : "border-white/10 bg-white/[.07] hover:bg-white/15"}`}><span className="block text-3xl">{animal.emoji}</span><span className="mt-1 block truncate text-[10px] font-bold text-white/60">{animal.name}</span></motion.button>;
          })}</div>}
        </section>

        <div className="mx-auto w-full max-w-md pb-3">
          {phase === "welcome" && <motion.button whileTap={{ scale: .96 }} onClick={begin} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-lg font-black text-slate-950 shadow-xl"><Sparkles /> Start challenge</motion.button>}
          {phase === "choose" && <motion.button whileTap={{ scale: .96 }} onClick={listening ? () => recognitionRef.current?.stop() : startListening} className={`flex h-14 w-full items-center justify-center gap-2 rounded-3xl font-black ${listening ? "bg-rose-500 text-white" : "bg-white text-slate-950"}`}>{listening ? <MicOff /> : <Mic />}{listening ? "Stop listening" : "Say an animal"}</motion.button>}
          {phase === "imitate" && <motion.button whileTap={{ scale: .96 }} onClick={markImitated} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-fuchsia-500 to-orange-400 text-lg font-black"><Volume2 /> I made the sound!</motion.button>}
          {phase === "celebrate" && <div className="h-14 text-center font-black text-amber-200">Sound Star earned! ⭐</div>}
          {phase === "finished" && <motion.button whileTap={{ scale: .96 }} onClick={restart} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-amber-300 to-orange-400 text-lg font-black text-slate-950"><RotateCcw /> Play again</motion.button>}
        </div>
      </div>
      <MiniMonto speaking={speaking} />
    </main>
  );
}
