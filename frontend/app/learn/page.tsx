"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Apple, ArrowLeft, ChevronRight, Palette, RotateCcw, Search, Shapes as ShapesIcon, Sparkles, Star, Trophy, Type, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";
import { MiniMonto } from "@/components/MiniMonto";
import type { Settings } from "@/types";

type TopicId = "shapes" | "colors" | "fruits" | "alphabet";
type Screen = "topics" | "learn" | "quiz" | "done";
type Item = { id: string; name: string; hint: string; color: string; emoji?: string };

const SHAPES: Item[] = [
  { id: "circle", name: "Circle", hint: "Round, with no corners at all", color: "#38BDF8" },
  { id: "square", name: "Square", hint: "Four sides, all the same length", color: "#F59E0B" },
  { id: "triangle", name: "Triangle", hint: "Three sides and three corners", color: "#22C55E" },
  { id: "rectangle", name: "Rectangle", hint: "Four sides — two long, two short", color: "#A78BFA" },
  { id: "star", name: "Star", hint: "Five sparkly points", color: "#FDE047" },
  { id: "oval", name: "Oval", hint: "Like a circle that got stretched", color: "#F472B6" },
  { id: "diamond", name: "Diamond", hint: "A square standing on its corner", color: "#22D3EE" },
  { id: "heart", name: "Heart", hint: "Two curves meeting at a point", color: "#FB7185" },
];

const COLORS: Item[] = [
  { id: "red", name: "Red", hint: "Like a juicy apple", color: "#EF4444", emoji: "🍎" },
  { id: "orange", name: "Orange", hint: "Like a fresh orange", color: "#F97316", emoji: "🍊" },
  { id: "yellow", name: "Yellow", hint: "Like a bright lemon", color: "#FACC15", emoji: "🍋" },
  { id: "green", name: "Green", hint: "Like fresh broccoli", color: "#22C55E", emoji: "🥦" },
  { id: "blue", name: "Blue", hint: "Like a blueberry", color: "#3B82F6", emoji: "🫐" },
  { id: "purple", name: "Purple", hint: "Like a bunch of grapes", color: "#A855F7", emoji: "🍇" },
  { id: "pink", name: "Pink", hint: "Like a pretty blossom", color: "#EC4899", emoji: "🌸" },
  { id: "brown", name: "Brown", hint: "Like a friendly bear", color: "#92400E", emoji: "🐻" },
];

const FRUITS: Item[] = [
  { id: "apple", name: "Apple", hint: "Crunchy and sweet", color: "#EF4444", emoji: "🍎" },
  { id: "banana", name: "Banana", hint: "Long, yellow, and peels easy", color: "#FACC15", emoji: "🍌" },
  { id: "grapes", name: "Grapes", hint: "Lots of tiny juicy balls", color: "#A855F7", emoji: "🍇" },
  { id: "watermelon", name: "Watermelon", hint: "Big, green, and so juicy", color: "#22C55E", emoji: "🍉" },
  { id: "strawberry", name: "Strawberry", hint: "Red with tiny seeds outside", color: "#F43F5E", emoji: "🍓" },
  { id: "mango", name: "Mango", hint: "Sweet, orange, and tropical", color: "#F97316", emoji: "🥭" },
  { id: "pineapple", name: "Pineapple", hint: "Spiky outside, sweet inside", color: "#EAB308", emoji: "🍍" },
  { id: "orange", name: "Orange", hint: "Round and full of vitamin C", color: "#F97316", emoji: "🍊" },
];

const ALPHABET: Item[] = [
  { id: "a", name: "A", hint: "A is for Apple!", color: "#EF4444", emoji: "🍎" },
  { id: "b", name: "B", hint: "B is for Ball!", color: "#F97316", emoji: "⚽" },
  { id: "c", name: "C", hint: "C is for Cat!", color: "#FACC15", emoji: "🐱" },
  { id: "d", name: "D", hint: "D is for Dog!", color: "#F59E0B", emoji: "🐶" },
  { id: "e", name: "E", hint: "E is for Elephant!", color: "#94A3B8", emoji: "🐘" },
  { id: "f", name: "F", hint: "F is for Fish!", color: "#3B82F6", emoji: "🐟" },
  { id: "g", name: "G", hint: "G is for Grapes!", color: "#A855F7", emoji: "🍇" },
  { id: "h", name: "H", hint: "H is for Hat!", color: "#0EA5E9", emoji: "🎩" },
  { id: "i", name: "I", hint: "I is for Ice cream!", color: "#F472B6", emoji: "🍦" },
  { id: "j", name: "J", hint: "J is for Juice!", color: "#F97316", emoji: "🧃" },
  { id: "k", name: "K", hint: "K is for Kite!", color: "#22D3EE", emoji: "🪁" },
  { id: "l", name: "L", hint: "L is for Lion!", color: "#F59E0B", emoji: "🦁" },
  { id: "m", name: "M", hint: "M is for Monkey!", color: "#92400E", emoji: "🐒" },
  { id: "n", name: "N", hint: "N is for Nest!", color: "#84CC16", emoji: "🪺" },
  { id: "o", name: "O", hint: "O is for Orange!", color: "#F97316", emoji: "🍊" },
  { id: "p", name: "P", hint: "P is for Parrot!", color: "#22C55E", emoji: "🦜" },
  { id: "q", name: "Q", hint: "Q is for Queen!", color: "#A855F7", emoji: "👸" },
  { id: "r", name: "R", hint: "R is for Rabbit!", color: "#F472B6", emoji: "🐰" },
  { id: "s", name: "S", hint: "S is for Sun!", color: "#FACC15", emoji: "☀️" },
  { id: "t", name: "T", hint: "T is for Tiger!", color: "#F97316", emoji: "🐯" },
  { id: "u", name: "U", hint: "U is for Umbrella!", color: "#3B82F6", emoji: "☂️" },
  { id: "v", name: "V", hint: "V is for Violin!", color: "#92400E", emoji: "🎻" },
  { id: "w", name: "W", hint: "W is for Watermelon!", color: "#22C55E", emoji: "🍉" },
  { id: "x", name: "X", hint: "X is for Xylophone!", color: "#EC4899", emoji: "🎹" },
  { id: "y", name: "Y", hint: "Y is for Yo-yo!", color: "#FACC15", emoji: "🪀" },
  { id: "z", name: "Z", hint: "Z is for Zebra!", color: "#1E293B", emoji: "🦓" },
];

const TOPICS = [
  { id: "shapes" as const, title: "Shapes", subtitle: "Circles, stars, hearts and more", icon: ShapesIcon, emoji: "🔺", gradient: "from-violet-400 to-indigo-500", glow: "rgba(167,139,250,.3)", items: SHAPES },
  { id: "colors" as const, title: "Colors", subtitle: "All the colors of the rainbow", icon: Palette, emoji: "🎨", gradient: "from-fuchsia-400 via-rose-400 to-amber-300", glow: "rgba(244,114,182,.3)", items: COLORS },
  { id: "fruits" as const, title: "Fruits", subtitle: "Yummy fruits to name and learn", icon: Apple, emoji: "🍎", gradient: "from-emerald-400 to-lime-400", glow: "rgba(52,211,153,.3)", items: FRUITS },
  { id: "alphabet" as const, title: "Alphabets", subtitle: "Learn your ABCs, letter by letter", icon: Type, emoji: "🔤", gradient: "from-sky-400 to-blue-600", glow: "rgba(56,189,248,.3)", items: ALPHABET },
];

const QUIZ_ROUNDS = 5;
const QUIZ_PRAISE = ["Yes! Well done!", "That's right!", "Super smart!", "You've got it!", "Brilliant!"];
const SETTINGS: Settings = { language: "english", voice: "female", autoSpeak: true, darkMode: true };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ShapeGlyph({ id, color, size = 96 }: { id: string; color: string; size?: number }) {
  switch (id) {
    case "circle": return <div className="rounded-full" style={{ width: size, height: size, background: color }} />;
    case "square": return <div className="rounded-xl" style={{ width: size, height: size, background: color }} />;
    case "rectangle": return <div className="rounded-xl" style={{ width: size * 1.4, height: size * 0.72, background: color }} />;
    case "oval": return <div className="rounded-full" style={{ width: size * 1.35, height: size * 0.8, background: color }} />;
    case "diamond": return <div className="rounded-md" style={{ width: size * 0.72, height: size * 0.72, background: color, transform: "rotate(45deg)" }} />;
    case "triangle": return <div style={{ width: 0, height: 0, borderLeft: `${size / 2}px solid transparent`, borderRight: `${size / 2}px solid transparent`, borderBottom: `${size}px solid ${color}` }} />;
    case "star": return <div style={{ width: size, height: size, background: color, clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)" }} />;
    case "heart": return <span style={{ fontSize: size, lineHeight: 1 }}>❤️</span>;
    default: return null;
  }
}

function ItemArt({ topicId, item, size = 140 }: { topicId: TopicId; item: Item; size?: number }) {
  if (topicId === "shapes") return <ShapeGlyph id={item.id} color={item.color} size={size * 0.68} />;
  if (topicId === "alphabet") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="font-kids font-black" style={{ fontSize: size * 0.5, color: item.color, lineHeight: 1 }}>{item.name}</span>
        {item.emoji && <span style={{ fontSize: size * 0.26 }}>{item.emoji}</span>}
      </div>
    );
  }
  if (topicId === "colors") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-full shadow-lg" style={{ width: size * 0.62, height: size * 0.62, background: item.color }} />
        {item.emoji && <span style={{ fontSize: size * 0.3 }}>{item.emoji}</span>}
      </div>
    );
  }
  return <span style={{ fontSize: size * 0.56, lineHeight: 1 }}>{item.emoji}</span>;
}

export default function LearnPage() {
  const router = useRouter();
  const { speak, cancel } = useTTS();
  const [screen, setScreen] = useState<Screen>("topics");
  const [topicId, setTopicId] = useState<TopicId | null>(null);
  const [index, setIndex] = useState(0);
  const [stars, setStars] = useState(0);
  const [message, setMessage] = useState("What should we learn today?");
  const [quizRound, setQuizRound] = useState(0);
  const [quizTarget, setQuizTarget] = useState<Item | null>(null);
  const [quizOptions, setQuizOptions] = useState<Item[]>([]);
  const [quizFeedback, setQuizFeedback] = useState<"correct" | "wrong" | null>(null);
  const [lastWrongId, setLastWrongId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topic = useMemo(() => TOPICS.find(t => t.id === topicId) ?? null, [topicId]);
  const item = topic ? topic.items[index] : null;

  const speakingRef = useRef(false);
  const [speaking, setSpeaking] = useState(false);
  const say = useCallback((text: string, emotion = "excited") => {
    speakingRef.current = true;
    setSpeaking(true);
    void speak(text, emotion, SETTINGS, undefined, () => { speakingRef.current = false; setSpeaking(false); });
  }, [speak]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => () => { clearTimer(); cancel(); }, [cancel, clearTimer]);

  // Narrate each flashcard as soon as it appears — the name plus its hint.
  useEffect(() => {
    if (screen !== "learn" || !topic || !item) return;
    setMessage(item.name);
    say(`[friendly]\n${item.name}. ${item.hint}.`, "happy");
  }, [screen, topic, item, say]);

  const askQuizQuestion = useCallback((t: NonNullable<typeof topic>) => {
    const target = t.items[Math.floor(Math.random() * t.items.length)];
    const distractors = shuffle(t.items.filter(i => i.id !== target.id)).slice(0, 2);
    setQuizTarget(target);
    setQuizOptions(shuffle([target, ...distractors]));
    setLastWrongId(null);
    setMessage(`Which one is ${target.name}?`);
    say(`[curious]\nCan you find the ${target.name.toLowerCase()}?`, "thinking");
  }, [say]);

  const pickTopic = (id: TopicId) => {
    const t = TOPICS.find(x => x.id === id)!;
    setTopicId(id);
    setIndex(0);
    setScreen("learn");
  };

  const nextCard = () => {
    if (!topic) return;
    if (index + 1 < topic.items.length) {
      setIndex(i => i + 1);
    } else {
      setQuizRound(0);
      setQuizFeedback(null);
      setScreen("quiz");
      askQuizQuestion(topic);
    }
  };

  const handleQuizAnswer = (picked: Item) => {
    if (!topic || quizFeedback) return;
    clearTimer();
    if (picked.id === quizTarget?.id) {
      setQuizFeedback("correct");
      setStars(s => s + 1);
      const praise = QUIZ_PRAISE[quizRound % QUIZ_PRAISE.length];
      setMessage(praise);
      say(`[happy]\n${praise}`, "happy");
      timerRef.current = setTimeout(() => {
        const nextRound = quizRound + 1;
        if (nextRound >= QUIZ_ROUNDS) {
          setScreen("done");
          setMessage(`You learned all the ${topic.title.toLowerCase()}!`);
          say(`[excited]\nAmazing! You are a ${topic.title} Superstar!`, "excited");
        } else {
          setQuizRound(nextRound);
          setQuizFeedback(null);
          askQuizQuestion(topic);
        }
      }, 1500);
    } else {
      setQuizFeedback("wrong");
      setLastWrongId(picked.id);
      setMessage("Not quite — try again!");
      say("[friendly]\nNot quite, try again!", "neutral");
      timerRef.current = setTimeout(() => { setQuizFeedback(null); setLastWrongId(null); }, 800);
    }
  };

  const backToTopics = () => {
    clearTimer();
    cancel();
    setScreen("topics");
    setTopicId(null);
    setIndex(0);
    setQuizRound(0);
    setQuizFeedback(null);
    setMessage("What should we learn today?");
  };

  const goHome = () => {
    clearTimer();
    cancel();
    router.push("/");
  };

  const progress = screen === "learn" && topic ? (index / topic.items.length) * 100
    : screen === "quiz" ? (quizRound / QUIZ_ROUNDS) * 100
    : 0;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#07111f] text-white select-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(168,85,247,.25),transparent_34%),radial-gradient(circle_at_88%_85%,rgba(34,211,238,.2),transparent_32%),linear-gradient(155deg,#07111f,#151431)]" />
      {["🔺", "🎨", "🍎", "⭐", "🌈", "🍌"].map((emoji, i) => (
        <motion.span key={i} className="absolute select-none text-3xl opacity-10" style={{ left: `${7 + i * 17}%`, top: `${10 + (i * 31) % 75}%` }} animate={{ y: [0, -14, 0], rotate: [-6, 8, -6] }} transition={{ duration: 3 + i * .3, repeat: Infinity }}>{emoji}</motion.span>
      ))}

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 py-5 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={screen === "topics" ? goHome : backToTopics} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 backdrop-blur transition hover:bg-white/20" aria-label="Back"><ArrowLeft /></button>
            <button onClick={goHome} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 backdrop-blur transition hover:bg-white/20" aria-label="Close"><X /></button>
          </div>
          <div className="text-center"><p className="text-[10px] font-black uppercase tracking-[.3em] text-violet-200/65">Monto Learn</p><h1 className="font-kids text-xl font-black">{topic ? topic.title : "Learn & Play"}</h1></div>
          <div className="flex h-11 items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 font-black text-amber-200"><Star className="h-4 w-4 fill-current" />{stars}</div>
        </header>

        {screen !== "topics" && (
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400" animate={{ width: `${progress}%` }} /></div>
        )}

        {screen === "topics" && (
          <section className="mx-auto mt-2 max-w-2xl text-center">
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", bounce: .4 }} className="mx-auto flex h-24 w-24 items-center justify-center text-7xl">
              <motion.span animate={{ y: [0, -10, 0], rotate: [-6, 6, -6] }} transition={{ duration: 2.4, repeat: Infinity }}>📚</motion.span>
            </motion.div>
            <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1, duration: .4 }} className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.25em] text-white/55">
              <Sparkles className="h-3 w-3 text-amber-300" /> Monto Learn
            </motion.span>
            <h2 className="mt-2 text-3xl font-black sm:text-5xl">Let&apos;s learn together!</h2>
            <p className="mx-auto mt-2 max-w-md text-base text-white/55">Pick a topic and Monto will teach you.</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TOPICS.map((t, i) => (
                <motion.button
                  key={t.id}
                  onClick={() => pickTopic(t.id)}
                  aria-label={`${t.title} — ${t.subtitle}`}
                  initial={{ opacity: 0, y: 40, scale: .9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: .15 + i * .12, type: "spring", bounce: .45, duration: .7 }}
                  whileHover={{ y: -8, rotate: i % 2 ? .6 : -.6, transition: { type: "spring", bounce: .6 } }}
                  whileTap={{ scale: .93, rotate: 0 }}
                  className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.075] p-5 text-left backdrop-blur-xl transition-colors hover:border-white/20"
                  style={{ boxShadow: `0 24px 65px ${t.glow}` }}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.gradient}`} />
                  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-80" style={{ background: t.glow, opacity: 0.55 }} />
                  <motion.span className="relative block text-6xl" animate={{ y: [0, -8, 0], rotate: [-6, 6, -6], scale: [1, 1.06, 1] }} transition={{ duration: 2.2, delay: i * .3, repeat: Infinity, ease: "easeInOut" }}>{t.emoji}</motion.span>
                  <h3 className="relative mt-4 text-2xl font-black">{t.title}</h3>
                  <p className="relative mt-1.5 text-sm leading-snug text-white/50">{t.subtitle}</p>
                  <div className="relative mt-5 flex items-center justify-between">
                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/70">{t.items.length} to learn</span>
                    <motion.span className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-slate-950 shadow-lg`} whileHover={{ scale: 1.15, rotate: 12 }} animate={{ scale: [1, 1.08, 1] }} transition={{ scale: { duration: 1.8, repeat: Infinity, delay: i * .25 } }}>
                      <t.icon className="h-5 w-5" />
                    </motion.span>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {screen !== "topics" && topic && (
          <section className="flex flex-1 flex-col items-center justify-center py-5 text-center">
            <AnimatePresence mode="wait">
              <motion.div key={`${screen}-${index}-${quizRound}`} initial={{ opacity: 0, scale: .88, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.08 }} className="w-full">
                <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-[3.5rem] border border-white/10 bg-white/10 shadow-[0_30px_80px_rgba(0,0,0,.3)] sm:h-60 sm:w-60" style={{ boxShadow: `0 25px 80px ${(screen === "learn" ? item?.color : quizTarget?.color) ?? topic.glow}30` }}>
                  {screen === "learn" && item && (
                    <motion.div key={item.id} animate={{ scale: [1, 1.08, 1], rotate: topic.id === "shapes" ? [0, 0, 0] : [-4, 4, -4] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                      <ItemArt topicId={topic.id} item={item} size={168} />
                    </motion.div>
                  )}
                  {screen === "quiz" && (
                    <motion.div animate={{ scale: [1, 1.1, 1], rotate: [-8, 8, -8] }} transition={{ duration: 1.4, repeat: Infinity }}>
                      <Search className="h-20 w-20 text-violet-300" />
                    </motion.div>
                  )}
                  {screen === "done" && (
                    <motion.div animate={{ y: [0, -10, 0], rotate: [-5, 5, -5] }} transition={{ duration: 1, repeat: Infinity }}>
                      <Trophy className="h-24 w-24 text-amber-300" />
                    </motion.div>
                  )}
                </div>

                <p className="mt-6 text-xs font-black uppercase tracking-[.28em]" style={{ color: (screen === "learn" ? item?.color : quizTarget?.color) ?? "#a78bfa" }}>
                  {screen === "learn" ? `${index + 1} / ${topic.items.length} · ${topic.title}` : screen === "quiz" ? `Quiz · ${quizRound + 1} / ${QUIZ_ROUNDS}` : "All done"}
                </p>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">{message}</h2>
                {screen === "learn" && item && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">{item.hint}</p>}
              </motion.div>
            </AnimatePresence>

            {screen === "quiz" && (
              <div className="mt-6 grid w-full max-w-lg grid-cols-3 gap-3">
                {quizOptions.map(opt => {
                  const showCorrect = quizFeedback === "correct" && opt.id === quizTarget?.id;
                  const showWrong = quizFeedback === "wrong" && opt.id === lastWrongId;
                  return (
                    <motion.button
                      key={opt.id}
                      onClick={() => handleQuizAnswer(opt)}
                      whileTap={{ scale: .92 }}
                      animate={showCorrect ? { scale: [1, 1.12, 1] } : showWrong ? { x: [0, -6, 6, -6, 0] } : {}}
                      className={`flex flex-col items-center gap-2 rounded-3xl border p-4 transition ${showCorrect ? "border-emerald-300 bg-emerald-400/20" : showWrong ? "border-rose-300 bg-rose-400/20" : "border-white/10 bg-white/[.07] hover:bg-white/15"}`}
                    >
                      <ItemArt topicId={topic.id} item={opt} size={64} />
                      <span className="text-xs font-bold text-white/70">{opt.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <div className="mx-auto w-full max-w-md pb-3">
          {screen === "learn" && (
            <motion.button whileTap={{ scale: .96 }} onClick={nextCard} className="flex h-16 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-violet-400 to-cyan-400 text-lg font-black text-slate-950 shadow-xl">
              {topic && index + 1 < topic.items.length ? "Next" : "Quiz time!"} <ChevronRight />
            </motion.button>
          )}
          {screen === "done" && (
            <div className="flex gap-3">
              <motion.button whileTap={{ scale: .96 }} onClick={backToTopics} className="flex h-16 flex-1 items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-amber-300 to-orange-400 text-base font-black text-slate-950"><RotateCcw className="h-5 w-5" /> Learn more</motion.button>
              <motion.button whileTap={{ scale: .96 }} onClick={goHome} className="flex h-16 flex-1 items-center justify-center gap-2 rounded-3xl border border-white/15 bg-white/10 text-base font-black text-white">Finish</motion.button>
            </div>
          )}
        </div>
      </div>
      <MiniMonto speaking={speaking} />
    </main>
  );
}
