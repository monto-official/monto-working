"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Heart, Mic, MicOff, Play, RotateCcw, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MiniMonto } from "@/components/MiniMonto";
import { Monto3DAvatar } from "@/components/Monto3DAvatar";
import { useTTS } from "@/hooks/useTTS";
import type { Settings } from "@/types";

type Choice = { text: string; emoji: string; kind: boolean; result: string; lesson: string };

const TTS_SETTINGS: Settings = { language: "english", voice: "female", autoSpeak: true, darkMode: true };
const VALUES = ["Kindness", "Honesty", "Fairness", "Helping", "Courage", "Respect", "Online safety", "Responsibility", "Greetings", "Positivity", "Body safety"] as const;

const stories = [
  { image: "/moral-game/scene-playground.png", place: "Playground", title: "The New Kid", scene: "🛝", friend: "🧒", question: "A new kid is standing alone. What will you do?", choices: [
    { text: "Invite them to play", emoji: "👋", kind: true, result: "Their worried face turns into a huge smile!", lesson: "Including someone can turn loneliness into friendship." },
    { text: "Ask a friend to invite them", emoji: "🤝", kind: true, result: "Your friend helps them join the game.", lesson: "Getting help is thoughtful too; next time, try saying hello yourself." },
    { text: "Keep playing", emoji: "🏃", kind: false, result: "The new kid stays alone and looks down.", lesson: "A small hello can help someone feel welcome." },
  ]},
  { image: "/moral-game/scene-classroom.png", place: "Classroom", title: "The Broken Crayon", scene: "🖍️", friend: "👧", question: "You accidentally break Maya's crayon. Nobody saw. What will you do?", choices: [
    { text: "Tell the truth and apologize", emoji: "🤝", kind: true, result: "Maya forgives you, and you fix it together!", lesson: "Telling the truth builds trust, even when it feels scary." },
    { text: "Ask a teacher to help explain", emoji: "🙋", kind: true, result: "The teacher helps you tell Maya what happened.", lesson: "Asking a trusted adult for help is responsible when honesty feels scary." },
    { text: "Hide it", emoji: "🙈", kind: false, result: "Maya feels confused, and your secret feels heavy.", lesson: "Mistakes are okay. Owning them is brave." },
  ]},
  { image: "/moral-game/scene-lunch.png", place: "Lunch Table", title: "One Cookie Left", scene: "🍪", friend: "🐻", question: "You both reach for the last cookie. What is fair?", choices: [
    { text: "Split it in half", emoji: "🫶", kind: true, result: "You both enjoy a piece and laugh together.", lesson: "Sharing makes a little treat twice as special." },
    { text: "Use a fair game to decide", emoji: "✋", kind: true, result: "You both agree on the rule and accept the result.", lesson: "A rule everyone agrees to can also be fair." },
    { text: "Grab it quickly", emoji: "✊", kind: false, result: "It tastes good, but your friend looks disappointed.", lesson: "Fairness means thinking about other people's feelings." },
  ]},
  { image: "/moral-game/scene-hallway.png", place: "School Hall", title: "Books Everywhere!", scene: "📚", friend: "🐰", question: "Someone drops their books, but you are late. What will you do?", choices: [
    { text: "Stop and help", emoji: "💪", kind: true, result: "Together, the books are gathered in seconds!", lesson: "Helping hands make hard jobs lighter." },
    { text: "Call a nearby adult to help", emoji: "📣", kind: true, result: "An adult comes over and helps gather the books.", lesson: "Finding safe help is useful when you cannot stop yourself." },
    { text: "Walk around", emoji: "🚶", kind: false, result: "They struggle alone as books slide away.", lesson: "A minute of your time can make a big difference." },
  ]},
  { image: "/moral-game/scene-football.png", place: "Football Field", title: "Was It a Goal?", scene: "⚽", friend: "🦊", question: "The ball missed, but the referee says goal. What do you say?", choices: [
    { text: "Be honest", emoji: "🌟", kind: true, result: "Both teams cheer your honesty. You feel proud!", lesson: "Real winners choose honesty over an unfair prize." },
    { text: "Tell my team captain first", emoji: "🗣️", kind: true, result: "Your captain helps explain the mistake to the referee.", lesson: "Speaking to a leader is a good step when speaking up alone feels hard." },
    { text: "Pretend it went in", emoji: "🤫", kind: false, result: "Your team gets a point, but it does not feel right.", lesson: "Winning feels best when everyone plays fairly." },
  ]},
  { image: "/moral-game/scene-classroom.png", place: "Group Project", title: "A Different Idea", scene: "🌈", friend: "🧑‍🤝‍🧑", question: "Your teammate shares an idea you disagree with. How do you respond?", choices: [
    { text: "Listen fully, then share my view kindly", emoji: "👂", kind: true, result: "You combine the best parts of both ideas.", lesson: "Respect means listening to understand, even when we disagree." },
    { text: "Ask the group to vote", emoji: "🗳️", kind: true, result: "The group decides, but first everyone gets a chance to explain.", lesson: "Fair decisions work best when every voice is heard." },
    { text: "Laugh and call the idea silly", emoji: "😏", kind: false, result: "Your teammate becomes quiet and stops sharing.", lesson: "We can disagree with an idea without embarrassing the person." },
  ]},
  { image: "/moral-game/scene-playground.png", place: "Online Game", title: "The Mean Message", scene: "🛡️", friend: "💬", question: "Someone sends a cruel message about your friend. What should you do?", choices: [
    { text: "Save it, block them, and tell an adult", emoji: "🛡️", kind: true, result: "A trusted adult reports the account and supports your friend.", lesson: "Online cruelty is never your fault. Save evidence and get help." },
    { text: "Leave the chat and check on my friend", emoji: "💛", kind: true, result: "Your friend feels supported and less alone.", lesson: "Supporting a friend matters; remember to involve a trusted adult too." },
    { text: "Send a mean message back", emoji: "🔥", kind: false, result: "The argument grows and more people get hurt.", lesson: "Pause, block, and ask for help instead of fighting cruelty with cruelty." },
  ]},
  { image: "/moral-game/scene-lunch.png", place: "At Home", title: "The Promise", scene: "✅", friend: "🌱", question: "You promised to tidy up, but your favorite show has started. What now?", choices: [
    { text: "Keep my promise first, then watch", emoji: "✅", kind: true, result: "The job is done quickly, and you enjoy the show without worrying.", lesson: "Responsibility means keeping promises even when something exciting appears." },
    { text: "Ask politely to finish after this short part", emoji: "⏰", kind: true, result: "You agree on a clear time and follow through.", lesson: "Plans can change when we communicate honestly and still do our part." },
    { text: "Pretend I did not hear", emoji: "📺", kind: false, result: "Someone else has to do your job and feels frustrated.", lesson: "Ignoring a promise moves our responsibility onto someone else." },
  ]},
  { image: "/moral-game/scene-playground.png", place: "At Grandma's House", title: "Greeting Grandma", scene: "🙏", friend: "👵", question: "Grandma just arrived to visit! How do you greet her respectfully?", choices: [
    { text: "Say Namaste with palms together and a bow", emoji: "🙏", kind: true, result: "Grandma's face lights up with joy at your respectful greeting!", lesson: "Namaste is a beautiful way to greet elders — palms together, a little bow, straight from the heart." },
    { text: "Give a friendly wave and say hi", emoji: "👋", kind: true, result: "Grandma smiles, though a Namaste would make her feel extra special.", lesson: "A wave is friendly, but Namaste shows extra respect to elders and guests." },
    { text: "Keep playing your game", emoji: "🎮", kind: false, result: "Grandma waits for a greeting that never comes.", lesson: "Greeting someone who arrives shows them you're happy to see them." },
  ]},
  { image: "/moral-game/scene-lunch.png", place: "At Home", title: "Rise and Shine", scene: "☀️", friend: "👨‍👩‍👧", question: "You wake up and see your family in the kitchen. What do you do?", choices: [
    { text: "Smile and say 'Good Morning!' to everyone", emoji: "😃", kind: true, result: "Everyone smiles back — what a happy way to start the day!", lesson: "A cheerful Good Morning can make everyone's whole day brighter." },
    { text: "Give a sleepy little wave", emoji: "🥱", kind: true, result: "They wave back, though a big smile would spread even more joy.", lesson: "Even a small greeting matters, but a warm one spreads more happiness." },
    { text: "Walk past without saying anything", emoji: "🚶", kind: false, result: "Everyone wonders if something is wrong.", lesson: "Greeting your family shows them you care, even first thing in the morning." },
  ]},
  { image: "/moral-game/scene-hallway.png", place: "Keeping Safe", title: "A Confusing Hug", scene: "🛡️", friend: "🧑", question: "Someone gives you a hug that makes you feel uncomfortable and asks you to keep it a secret. What do you do?", choices: [
    { text: "Say 'No thank you' and tell a trusted grown-up right away", emoji: "🗣️", kind: true, result: "A trusted grown-up listens, helps you feel safe, and you feel proud you spoke up!", lesson: "Your body belongs to you. If something feels wrong, telling a trusted adult is always the brave, right choice — even if someone asks you to keep it secret." },
    { text: "Walk away and tell a parent later", emoji: "🚶", kind: true, result: "You feel safe again once you tell someone you trust.", lesson: "It's always okay to walk away from a touch that feels wrong, and telling later still helps." },
    { text: "Keep the secret because they asked you to", emoji: "🤫", kind: false, result: "You feel worried and confused inside.", lesson: "Never keep a touch a secret if it makes you uncomfortable — always tell a trusted grown-up, no matter what anyone says. It is never your fault." },
  ]},
] as const;

export default function MoralGamePage() {
  const router = useRouter();
  const { speak, cancel } = useTTS();
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<Choice | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [micStatus, setMicStatus] = useState<"blocked" | "calibrating" | "ready">("blocked");
  const [noiseFloor, setNoiseFloor] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const micStream = useRef<MediaStream | null>(null);
  const calibrationRun = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  const done = round >= stories.length;
  const story = stories[Math.min(round, stories.length - 1)];

  const choose = (choice: Choice) => {
    if (answer) return;
    setAnswer(choice);
    if (choice.kind) setScore(value => value + 1);
  };
  const restart = () => { setRound(0); setScore(0); setAnswer(null); setStarted(true); };

  useEffect(() => {
    if (!started || !soundOn || done) return;
    const words = answer ? answer.result + " " + answer.lesson : story.title + ". " + story.question;
    void speak(words, answer?.kind === false ? "thinking" : "happy", TTS_SETTINGS, () => setSpeaking(true), () => setSpeaking(false));
    return () => { cancel(); setSpeaking(false); };
  }, [answer, cancel, done, round, soundOn, speak, started, story]);

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

  const startAdventure = () => {
    setStarted(true);
    setAnswer(null);
  };

  const toggleSound = () => {
    if (soundOn) cancel();
    setSoundOn(value => !value);
  };

  return <main className="relative min-h-[100dvh] overflow-hidden bg-[#10122d] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(251,191,36,.25),transparent_30%),radial-gradient(circle_at_85%_78%,rgba(244,114,182,.23),transparent_34%),linear-gradient(145deg,#11132f,#21133b)]" />
    {["✨","💛","⭐","🌈","💫","🌼"].map((item, i) => <motion.span key={i} className="absolute select-none text-3xl opacity-20" style={{ left: (5 + i * 18) + "%", top: (12 + (i * 23) % 72) + "%" }} animate={{ y: [0,-18,0], rotate: [-8,8,-8] }} transition={{ duration: 3 + i * .3, repeat: Infinity }}>{item}</motion.span>)}
    <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 py-5 sm:px-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/games")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Back to games"><ArrowLeft /></button>
          <button onClick={() => router.push("/")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10" aria-label="Close"><X /></button>
        </div>
        <div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-200/70">Monto presents</p><h1 className="text-xl font-black">Moral Adventure</h1></div>
        {started ? <div className="flex h-11 min-w-16 items-center justify-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/15 px-3 font-black text-amber-200" aria-label={`${score} heart powers earned`}><Heart className="h-4 w-4 fill-current" />{score}</div> : <div className="h-11 w-11" aria-hidden="true" />}
      </header>
      <section className="flex flex-1 items-center justify-center py-7"><AnimatePresence mode="wait">
        {!started ? <motion.div key="start" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="grid w-full items-center gap-5 py-2 lg:grid-cols-[.9fr_1.1fr] lg:text-left">
          <div className="relative mx-auto h-64 w-64 sm:h-72 sm:w-72">
            <div className="absolute inset-5 rounded-full bg-cyan-300/15 ring-1 ring-cyan-200/25" />
            <Monto3DAvatar emotion={speaking ? "talking" : "excited"} size={288} />
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }} className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-xl">Hi, I&apos;m Monto!</motion.div>
          </div>
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase text-amber-200"><Heart className="h-4 w-4 fill-current" /> {stories.length} stories · {stories.length} heart powers</div>
            <h2 className="mt-5 font-kids text-4xl font-black leading-tight sm:text-5xl">Become a<br className="hidden sm:block" /> Heart Hero!</h2>
            <p className="mx-auto mt-4 max-w-lg text-base font-medium leading-7 text-white/75 lg:mx-0">Monto will tell you a story. You choose what to do, see how others feel, and learn a power you can use in real life.</p>
            <div className="mx-auto mt-5 grid max-w-lg grid-cols-2 gap-2 text-left lg:mx-0">
              {[['💛','Be kind'],['🌟','Tell the truth'],['⚖️','Choose fairly'],['🛡️','Be brave']].map(([icon, label]) => <div key={label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.07] px-3 py-3 text-sm font-bold"><span className="text-xl">{icon}</span>{label}</div>)}
            </div>
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: .97 }} onClick={startAdventure} className="mx-auto mt-6 flex h-16 w-full max-w-lg items-center justify-center gap-3 rounded-2xl bg-amber-300 text-lg font-black text-slate-950 shadow-[0_14px_40px_rgba(251,191,36,.28)] lg:mx-0"><Play className="fill-current" />Start my first story</motion.button>
            <p className="mt-3 text-sm font-semibold text-white/45">No wrong feelings. Monto helps you think and try again.</p>
          </div>
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
                <p className="text-xs font-black uppercase tracking-[.24em] text-amber-200">Story {round + 1} of {stories.length} · {VALUES[round]}</p>
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
              {answer.kind ? <motion.button whileTap={{ scale: .97 }} onClick={() => { setAnswer(null); setRound(value => value + 1); }} className="mt-6 h-14 w-full rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 font-black text-slate-950">{round === stories.length - 1 ? "See my heart powers" : "Next story →"}</motion.button> : <motion.button whileTap={{ scale: .97 }} onClick={() => setAnswer(null)} className="mt-6 h-14 w-full rounded-2xl bg-amber-300 font-black text-slate-950">Think again and try another choice</motion.button>}
            </>}</div>
          </div>
        </motion.div>}
      </AnimatePresence></section>
    </div>
    {started && <MiniMonto speaking={speaking} />}
  </main>;
}
