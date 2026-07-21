"use client";
import { motion, AnimatePresence } from "framer-motion";
import { RecordingState } from "@/types";

interface StatusIndicatorProps {
  state: RecordingState;
  error: string | null;
}

const STATUS_CONFIG: Record<
  RecordingState,
  { label: string; color: string; dot: string }
> = {
  idle: { label: "Tap to speak", color: "text-gray-500 dark:text-gray-400", dot: "bg-gray-400" },
  requesting: { label: "Requesting microphone...", color: "text-yellow-600", dot: "bg-yellow-400" },
  recording: { label: "Listening...", color: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  processing: { label: "Processing...", color: "text-primary-600 dark:text-primary-400", dot: "bg-primary-500" },
  speaking: { label: "Monto is speaking...", color: "text-secondary-600 dark:text-secondary-400", dot: "bg-secondary-500" },
  error: { label: "Something went wrong", color: "text-red-600", dot: "bg-red-500" },
};

export function StatusIndicator({ state, error }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[state];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={error ? "error" : state}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2 justify-center"
      >
        <motion.div
          className={`w-2 h-2 rounded-full ${error ? "bg-red-500" : config.dot}`}
          animate={
            state === "recording" || state === "processing" || state === "speaking"
              ? { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }
              : {}
          }
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <span className={`text-sm font-medium ${error ? "text-red-600" : config.color}`}>
          {error || config.label}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
