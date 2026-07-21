"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Emotion, Intent } from "@/types";

interface ResponseCardProps {
  response: string;
  emotion?: Emotion;
  intent?: Intent;
  isSpeaking?: boolean;
}

const INTENT_EMOJI: Record<Intent, string> = {
  GENERAL_QUESTION: "💡",
  HOMEWORK: "📚",
  STORY: "📖",
  JOKE: "😄",
  GREETING: "👋",
  UNKNOWN: "🤔",
};

const EMOTION_GRADIENT: Record<Emotion, string> = {
  happy: "from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20",
  thinking: "from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
  excited: "from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20",
  sad: "from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20",
  surprised: "from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20",
  neutral: "from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20",
  talking: "from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20",
};

export function ResponseCard({ response, emotion = "neutral", intent, isSpeaking }: ResponseCardProps) {
  return (
    <AnimatePresence>
      {response && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.3 }}
          className={`w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br ${EMOTION_GRADIENT[emotion]} p-4 shadow-sm`}
        >
          <div className="flex items-start gap-3">
            <motion.div
              className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center"
              animate={isSpeaking ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 0.5, repeat: isSpeaking ? Infinity : 0 }}
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  Monto
                </p>
                {intent && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {INTENT_EMOJI[intent]}
                  </span>
                )}
              </div>
              <p className="text-gray-800 dark:text-gray-100 text-sm leading-relaxed">
                {response}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
