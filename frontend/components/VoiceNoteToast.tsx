"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useDeviceChannelContext } from "@/components/DeviceChannelProvider";

// Rendered once inside DeviceChannelProvider (above every route) so a
// parent's voice message announces itself no matter which screen the child
// is currently on — the provider already force-played the audio; this is
// just the visual toast on top of it.
export function VoiceNoteToast() {
  const { incomingVoiceNote, voiceNoteBlocked, retryVoiceNote, dismissVoiceNote } = useDeviceChannelContext();

  return (
    <AnimatePresence>
      {incomingVoiceNote && (
        <motion.div
          className="fixed top-6 left-1/2 z-[999] w-[90vw] max-w-sm -translate-x-1/2"
          initial={{ opacity: 0, y: -40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0,   scale: 1   }}
          exit={{   opacity: 0, y: -30,  scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        >
          <div
            className="rounded-3xl px-5 py-4 flex items-center gap-4"
            style={{
              background: "linear-gradient(135deg, #7C3AED, #A855F7, #D8B4FE)",
              boxShadow: "0 0 40px rgba(124,58,237,0.5), 0 8px 32px rgba(0,0,0,0.4)",
              cursor: voiceNoteBlocked ? "pointer" : "default",
            }}
            onClick={voiceNoteBlocked ? retryVoiceNote : undefined}
          >
            <motion.div
              className="text-4xl flex-shrink-0"
              animate={{ rotate: [0, -8, 8, -8, 0] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            >
              💌
            </motion.div>

            <div className="flex-1">
              <p className="text-white font-bold text-sm leading-snug">
                Voice message from your parent!
              </p>
              <p className="text-white/80 text-xs mt-0.5">
                {voiceNoteBlocked ? "Tap here to listen 🎧" : "Playing it now — listen up! 🎧"}
              </p>
            </div>

            <motion.button
              onClick={(e) => { e.stopPropagation(); dismissVoiceNote(); }}
              className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"
              whileTap={{ scale: 0.85 }}
            >
              <X className="w-3.5 h-3.5 text-white" />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
