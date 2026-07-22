"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Heart, Mic, MicOff, Play, RotateCcw, Trophy, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Choice = { text: string; emoji: string; kind: boolean; result: string; lesson: string };

const stories = [
  { image: "/moral-game/scene-playground.png", place: "Playground", title: "The New Kid", scene: "🛝", friend: "🧒", question: "A new kid is standing alone. What will you do?", choices: [
    { text: "Invite them to play", emoji: "👋", kind: true, result: "Their worried face turns into a huge smile!", lesson: "Including someone can turn loneliness into friendship." },
    { text: "Keep playing", emoji: "🏃", kind: false, result: "The new kid stays alone and looks down.", lesson: "A small hello can help someone feel welcome." },
  ]},
  { image: "/moral-game/scene-classroom.png", place: "Classroom", title: "The Broken Crayon", scene: "🖍️", friend: "👧", question: "You accidentally break Maya's crayon. Nobody saw. What will you do?", choices: [
    { text: "Tell the truth and apologize", emoji: "🤝", kind: true, result: "Maya forgives you, and you fix it together!", lesson: "Telling the truth builds trust, even when it feels scary." },
    { text: "Hide it", emoji: "🙈", kind: false, result: "Maya feels confused, and your secret feels heavy.", lesson: "Mistakes are okay. Owning them is brave." },
  ]},
  { image: "/moral-game/scene-lunch.png", place: "Lunch Table", title: "One Cookie Left", scene: "🍪", friend: "🐻", question: "You both reach for the last cookie. What is fair?", choices: [
    { text: "Split it in half", emoji: "🫶", kind: true, result: "You both enjoy a piece and laugh together.", lesson: "Sharing makes a little treat twice as special." },
    { text: "Grab it quickly", emoji: "✊", kind: false, result: "It tastes good, but your friend looks disappointed.", lesson: "Fairness means thinking about other people's feelings." },
  ]},
  { image: "/moral-game/scene-hallway.png", place: "School Hall", title: "Books Everywhere!", scene: "📚", friend: "🐰", question: "Someone drops their books, but you are late. What will you do?", choices: [
    { text: "Stop and help", emoji: "💪", kind: true, result: "Together, the books are gathered in seconds!", lesson: "Helping hands make hard jobs lighter." },
    { text: "Walk around", emoji: "🚶", kind: false, result: "They struggle alone as books slide away.", lesson: "A minute of your time can make a big difference." },
  ]},
  { image: "/moral-game/scene-football.png", place: "Football Field", title: "Was It a Goal?", scene: "⚽", friend: "🦊", question: "The ball missed, but the referee says goal. What do you say?", choices: [
    { text: "Be honest", emoji: "🌟", kind: true, result: "Both teams cheer your honesty. You feel proud!", lesson: "Real winners choose honesty over an unfair prize." },
    { text: "Pretend it went in", emoji: "🤫", kind: false, result: "Your team gets a point, but it does not feel right.", lesson: "Winning feels best when everyone plays fairly." },
  ]},
] as const;

export default function MoralGamePage() {
  const router = useRouter();
  const [started, setStarted] = useState(true);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<Choice | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [micStatus, setMicStatus] = useState<"blocked" | "calibrating" | "ready">("blocked");
  const [noiseFloor, setNoiseFloor] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const micStream = useRef<MediaStream | null>(null);
  const calibrationRun = useRef(0);
  const done = round >= stories.length;
  const story = stories[Math.min(round, stories.length - 1)];

  const choose = (choice: Choice) => {
    if (answer) return;
    setAnswer(choice);
    if (choice.kind) setScore(value => value + 1);
  };
  const restart = () => { setRound(0); setScore(0); setAnswer(null); setStarted(true); };

  useEffect(() => {
    if (!soundOn || done) return;
    window.speechSynthesis.cancel();
    const words = answer ? answer.result + " " + answer.lesson : story.title + ". " + story.question;
    const speech = new SpeechSynthesisUtterance(words);
    speech.rate = .88;
    speech.pitch = 1.08;
    window.speechSynthesis.speak(speech);
    return () => window.speechSynthesis.cancel();
  }, [answer, done, round, soundOn, story]);

  useEffect(() => () => {
    calibrationRun.current += 1;
    micStream.current?.getTracks().forEach(track => track.stop());
    window.speechSynthesis.cancel();
  }, []);

  const enableAndCalibrateMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.current?.getTracks().forEach(track => track.stop());
      micStream.current = stream;
      setMicOn(true);
      setMicStatus("calibrating");

      const run = ++calibrationRun.current;
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      let total = 0;
      let frames = 0;
      const startedAt = performance.now();

      const sampleRoom = () => {
        if (run !== calibrationRun.current) {
          void context.close();
          return;
        }
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) energy += sample * sample;
        total += Math.sqrt(energy / samples.length);
        frames += 1;
        if (performance.now() - startedAt < 2200) {
          requestAnimationFrame(sampleRoom);
          return;
        }
        const floor = frames ? total / frames : 0;
        setNoiseFloor(Math.max(1, Math.min(100, Math.round(floor * 650))));
        setMicStatus("ready");
        void context.close();
      };
      requestAnimationFrame(sampleRoom);
    } catch {
      setMicOn(false);
      setMicStatus("blocked");
    }
  };

  const toggleMic = async () => {
    if (micOn) {
      calibrationRun.current += 1;
      micStream.current?.getTracks().forEach(track => track.stop());
      micStream.current = null;
      setMicOn(false);
      setMicStatus("blocked");
      return;
    }
    await enableAndCalibrateMic();
  };

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: "microphone" as PermissionName }).then(permission => {
      if (permission.state === "granted") void enableAndCalibrateMic();
    }).catch(() => undefined);
  }, []);

  const toggleSound = () => {
    if (soundOn) window.speechSynthesis.cancel();
    setSoundOn(value => !value);
  };

  return <main className="relative min-h-[100dvh] overflow-hidden bg-[#10122d] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(251,191,36,.25),transparent_30%),radial-gradient(circle_at_85%_78%,rgba(244,114,182,.23),transparent_34%),linear-gradient(145deg,#11132f,#21133b)]" />
    {["✨","💛","⭐","🌈","💫","🌼"].map((item, i) => <motion.span key={i} className="absolute select-none text-3xl opacity-20" style={{ left: (5 + i * 18) + "%", top: (12 + (i * 23) % 72) + "%" }} animate={{ y: [0,-18,0], rotate: [-8,8,-8] }} transition={{ duration: 3 + i * .3, repeat: Infinity }}>{item}</motion.span>)}
    <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 py-5 sm:px-8">
      <header className="flex items-center justify-between">
        <button onClick={() => router.push("/games")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Back to games"><ArrowLeft /></button>
        <div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-200/70">Monto presents</p><h1 className="text-xl font-black">Moral Adventure</h1></div>
        <div className="flex h-11 items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 font-black text-amber-200"><Heart className="h-4 w-4 fill-current" />{score}</div>
      </header>
      <section className="flex flex-1 items-center justify-center py-7"><AnimatePresence mode="wait">
        {!started ? <motion.div key="start" initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} className="w-full text-center">
          <motion.div animate={{ y: [0,-12,0], rotate: [-3,3,-3] }} transition={{ repeat: Infinity, duration: 2 }} className="mx-auto flex h-52 w-52 items-center justify-center rounded-[4rem] border border-amber-200/20 bg-amber-300/10 text-8xl shadow-[0_30px_90px_rgba(251,146,60,.2)]">🧭</motion.div>
          <p className="mt-7 text-xs font-black uppercase tracking-[.3em] text-amber-200">Your choices shape the story</p><h2 className="mt-3 text-4xl font-black">What would you do?</h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/60">Choose an action and watch how it makes others feel.</p>
          <motion.button whileTap={{ scale: .96 }} onClick={() => setStarted(true)} className="mx-auto mt-8 flex h-16 w-full max-w-md items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 text-lg font-black text-slate-950"><Play className="fill-current" />Start adventure</motion.button>
        </motion.div> : done ? <motion.div key="done" initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} className="w-full text-center">
          <motion.div animate={{ rotate: [-5,5,-5], scale: [1,1.08,1] }} transition={{ repeat: Infinity, duration: 1.4 }}><Trophy className="mx-auto h-32 w-32 text-amber-300 drop-shadow-[0_0_24px_rgba(251,191,36,.6)]" /></motion.div>
          <h2 className="mt-6 text-4xl font-black">Heart Hero!</h2><p className="mt-3 text-xl font-bold text-amber-200">You collected {score} of {stories.length} hearts.</p>
          <p className="mx-auto mt-4 max-w-md text-white/60">{score === stories.length ? "You chose kindness, fairness, and honesty every time!" : "Every choice is a chance to learn. Try the other paths too!"}</p>
          <button onClick={restart} className="mx-auto mt-8 flex h-16 w-full max-w-md items-center justify-center gap-3 rounded-3xl bg-amber-300 font-black text-slate-950"><RotateCcw />Play again</button>
        </motion.div> : <motion.div key={round + "-" + Boolean(answer)} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="w-full">
          <div className="mb-5 flex gap-2">{stories.map((_, i) => <span key={i} className={"h-2 flex-1 rounded-full " + (i < round ? "bg-emerald-400" : i === round ? "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,.7)]" : "bg-white/10")} />)}</div>
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.08] shadow-2xl backdrop-blur-xl">
            <div className="relative h-64 overflow-hidden bg-slate-900 sm:h-80">
              <motion.img key={story.image} src={story.image} alt={story.title} className="h-full w-full object-cover" initial={{ scale: 1.08, opacity: 0 }} animate={{ scale: 1, opacity: 1, x: [0, -5, 0] }} transition={{ opacity: { duration: .5 }, scale: { duration: 4 }, x: { duration: 7, repeat: Infinity } }} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#15152f] via-transparent to-black/20" />
              <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/45 px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">{story.place}</span>
              <motion.div key={String(Boolean(answer))} initial={{ opacity: 0, scale: .6, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute bottom-4 right-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/40 bg-white/90 text-4xl shadow-2xl">
                {answer ? (answer.kind ? "😊" : "😟") : "🤔"}
              </motion.div>
              <div className="absolute bottom-5 left-5">
                <p className="text-xs font-black uppercase tracking-[.24em] text-amber-200">Story {round + 1} of {stories.length}</p>
                <h2 className="mt-1 text-2xl font-black drop-shadow-lg sm:text-3xl">{story.title}</h2>
              </div>
            </div>
            <div className="p-5 sm:p-7">{!answer ? <>
              <p className="text-lg font-bold leading-7 text-white/90">{story.question}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">{story.choices.map((choice, i) => <motion.button key={choice.text} whileHover={{ y: -3 }} whileTap={{ scale: .97 }} onClick={() => choose(choice)} className="flex min-h-24 items-center gap-4 rounded-2xl border border-white/10 bg-white/[.08] p-4 text-left font-bold hover:bg-white/[.14]"><span className="text-4xl">{choice.emoji}</span><span><small className="block uppercase tracking-widest text-white/35">Option {i + 1}</small>{choice.text}</span></motion.button>)}</div>
            </> : <>
              <div className={"inline-flex rounded-full px-3 py-1 text-xs font-black text-slate-950 " + (answer.kind ? "bg-emerald-400" : "bg-violet-400")}>{answer.kind ? "HEARTWARMING CHOICE!" : "LET'S THINK ABOUT IT"}</div>
              <p className="mt-4 text-sm leading-6 text-white/70">{answer.result}</p>
              <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/10 p-4"><p className="text-[10px] font-black uppercase tracking-[.22em] text-amber-200">Monto's little lesson</p><p className="mt-2 text-sm font-semibold leading-6">{answer.lesson}</p></div>
              <motion.button whileTap={{ scale: .97 }} onClick={() => { setAnswer(null); setRound(value => value + 1); }} className="mt-6 h-14 w-full rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 font-black text-slate-950">{round === stories.length - 1 ? "See my result" : "Next story →"}</motion.button>
            </>}</div>
          </div>
        </motion.div>}
      </AnimatePresence></section>
    </div>
  </main>;
}