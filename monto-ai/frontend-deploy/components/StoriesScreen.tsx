"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, X, Square, BookOpen } from "lucide-react";
import { STORIES, type Story } from "@/lib/media-content";

interface StoriesScreenProps {
  onClose: () => void;
}

export function StoriesScreen({ onClose }: StoriesScreenProps) {
  const [activeStory, setActiveStory]   = useState<Story | null>(null);
  const [isReading, setIsReading]       = useState(false);
  const [wordIndex, setWordIndex]       = useState(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wordsRef     = useRef<string[]>([]);

  const stopReading = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsReading(false);
    setWordIndex(0);
  }, []);

  const readStory = useCallback((story: Story) => {
    stopReading();
    const words = story.url.split(" ");
    wordsRef.current = words;
    setActiveStory(story);
    setWordIndex(0);

    if (!window.speechSynthesis) return;

    const utter = new SpeechSynthesisUtterance(story.url);
    utter.rate  = 0.85;
    utter.pitch = 1.1;
    utter.lang  = "en-US";

    // Try to pick a pleasant voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith("en") && (v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Karen"))
    ) || voices.find(v => v.lang.startsWith("en"));
    if (preferred) utter.voice = preferred;

    utter.onboundary = (e) => {
      if (e.name === "word") {
        const idx = story.url.slice(0, e.charIndex).split(" ").length - 1;
        setWordIndex(Math.max(0, idx));
      }
    };
    utter.onend = () => { setIsReading(false); setWordIndex(words.length); };

    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
    setIsReading(true);
  }, [stopReading]);

  const togglePause = useCallback(() => {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsReading(true);
    } else {
      window.speechSynthesis.pause();
      setIsReading(false);
    }
  }, []);

  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const words = activeStory ? activeStory.url.split(" ") : [];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
      transition={{ type:"spring", stiffness:300, damping:30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-5 pb-3">
        <motion.button onClick={() => { stopReading(); onClose(); }} whileTap={{ scale:0.85 }}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <X className="w-4 h-4 text-white" />
        </motion.button>
        <div className="text-center">
          <p className="text-white font-bold text-lg">📖 Stories</p>
          <p className="text-white/40 text-xs">{STORIES.length} stories</p>
        </div>
        <div className="w-9" />
      </div>

      {/* Story reader */}
      <AnimatePresence>
        {activeStory && (
          <motion.div className="mx-4 mb-3 rounded-2xl p-4 flex flex-col gap-3"
            style={{ background:`linear-gradient(135deg,${activeStory.color}20,${activeStory.color}08)`, border:`1px solid ${activeStory.color}40` }}
            initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
          >
            <div className="flex items-center gap-3">
              <motion.div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background:`${activeStory.color}30` }}
                animate={isReading ? { scale:[1,1.06,1] } : {}}
                transition={{ duration:1.2, repeat:Infinity }}
              >
                {activeStory.emoji}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{activeStory.title}</p>
                <p className="text-white/50 text-xs">{activeStory.description}</p>
              </div>
            </div>

            {/* Highlighted text */}
            <div className="rounded-xl bg-black/30 p-3 max-h-32 overflow-y-auto text-sm leading-relaxed">
              {words.map((word, i) => (
                <span key={i}
                  className={`transition-colors duration-100 ${
                    i === wordIndex ? "font-bold" : "text-white/60"
                  }`}
                  style={{ color: i === wordIndex ? activeStory.color : undefined }}
                >
                  {word}{" "}
                </span>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-5">
              <motion.button onClick={togglePause} whileTap={{ scale:0.9 }}
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: activeStory.color }}>
                {isReading
                  ? <Pause className="w-5 h-5 text-white" />
                  : <Play  className="w-5 h-5 text-white ml-0.5" />
                }
              </motion.button>
              <motion.button onClick={stopReading} whileTap={{ scale:0.9 }}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <Square className="w-4 h-4 text-white/60" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story list */}
      <div className="flex-1 overflow-y-auto px-4 pb-safe pb-6 space-y-3">
        {STORIES.map((story, i) => {
          const active = activeStory?.id === story.id;
          return (
            <motion.button key={story.id} onClick={() => readStory(story)}
              className="w-full text-left rounded-2xl p-4"
              style={{
                background: active ? `${story.color}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? story.color+"50" : "rgba(255,255,255,0.06)"}`,
              }}
              whileTap={{ scale:0.97 }}
              initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }}
              transition={{ delay: i*0.05 }}
            >
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background:`${story.color}25` }}>
                  {story.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`font-bold text-sm ${active ? "text-white" : "text-white/90"}`}>
                      {story.title}
                    </p>
                    {active && isReading && (
                      <div className="flex items-end gap-0.5 h-3">
                        {[0,1,2].map(j => (
                          <motion.div key={j} className="w-0.5 rounded-full"
                            style={{ background: story.color }}
                            animate={{ height:["30%","100%","30%"] }}
                            transition={{ duration:0.5, repeat:Infinity, delay:j*0.15 }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-white/40 text-xs leading-snug">{story.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-white/30 text-xs flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> {story.duration}
                    </span>
                    {active
                      ? <span className="text-xs font-semibold" style={{ color:story.color }}>
                          {isReading ? "Reading..." : "Paused"}
                        </span>
                      : <span className="text-white/30 text-xs">Tap to listen</span>
                    }
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
