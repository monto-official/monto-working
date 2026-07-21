"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Square, Loader2 } from "lucide-react";
import { RecordingState } from "@/types";
import { cn } from "@/lib/utils";

interface MicButtonProps {
  state: RecordingState;
  audioLevel: number;
  onPress: () => void;
  disabled?: boolean;
}

export function MicButton({ state, audioLevel, onPress, disabled }: MicButtonProps) {
  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const isRequesting = state === "requesting";

  const ringScale = 1 + audioLevel * 0.4;

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse rings when recording */}
      <AnimatePresence>
        {isRecording && (
          <>
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-red-500"
                initial={{ width: 80, height: 80, opacity: 0.6 }}
                animate={{
                  width: [80, 80 + i * 40 + audioLevel * 30],
                  height: [80, 80 + i * 40 + audioLevel * 30],
                  opacity: [0.4, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: "easeOut",
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        onClick={onPress}
        disabled={disabled || isProcessing || isRequesting}
        className={cn(
          "relative z-10 w-20 h-20 rounded-full flex items-center justify-center",
          "shadow-2xl focus:outline-none focus:ring-4 focus:ring-offset-2",
          "transition-colors duration-200",
          isRecording
            ? "bg-red-500 focus:ring-red-300 hover:bg-red-600"
            : isProcessing || isRequesting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-br from-primary-500 to-secondary-500 focus:ring-primary-300 hover:from-primary-600 hover:to-secondary-600"
        )}
        whileHover={!disabled && !isProcessing ? { scale: 1.08 } : {}}
        whileTap={!disabled && !isProcessing ? { scale: 0.94 } : {}}
        animate={
          isRecording
            ? { scale: [1, ringScale * 0.05 + 1, 1] }
            : { scale: 1 }
        }
        transition={isRecording ? { duration: 0.15 } : {}}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        <AnimatePresence mode="wait">
          {isProcessing || isRequesting ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0, rotate: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-8 h-8 text-white" />
            </motion.div>
          ) : isRecording ? (
            <motion.div
              key="stop"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <Square className="w-8 h-8 text-white fill-white" />
            </motion.div>
          ) : (
            <motion.div
              key="mic"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <Mic className="w-8 h-8 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
