"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CallState } from "@/types";

interface CallControlsProps {
  callState: CallState;
  isMuted: boolean;
  onCall: () => void;
  onAnswer: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
}

function RoundButton({
  onClick,
  color,
  disabled,
  pulse,
  className,
  children,
  label,
}: {
  onClick: () => void;
  color: string;
  disabled?: boolean;
  pulse?: boolean;
  className?: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        whileTap={disabled ? {} : { scale: 0.92 }}
        whileHover={disabled ? {} : { scale: 1.07 }}
        className={cn(
          "relative flex items-center justify-center rounded-full w-16 h-16 transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          color,
          className
        )}
      >
        {pulse && (
          <span
            className={cn(
              "absolute inset-0 rounded-full animate-ping opacity-40",
              color
            )}
          />
        )}
        <span className="relative">{children}</span>
      </motion.button>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

export function CallControls({
  callState,
  isMuted,
  onCall,
  onAnswer,
  onDecline,
  onHangUp,
  onToggleMute,
}: CallControlsProps) {
  const inCall    = callState === "in-call";
  const isCalling = callState === "calling";
  const incoming  = callState === "incoming";
  const isReady   = callState === "registered";

  return (
    <div className="flex items-center justify-center gap-6 py-4">
      <AnimatePresence mode="wait">
        {/* ── IDLE / READY ────────────────────────────────────────── */}
        {isReady && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-center gap-6"
          >
            <RoundButton
              label="Call Monto"
              onClick={onCall}
              color="bg-emerald-600 hover:bg-emerald-500 text-white"
              pulse
            >
              <Phone size={26} />
            </RoundButton>
          </motion.div>
        )}

        {/* ── OUTBOUND CALLING ───────────────────────────────────── */}
        {isCalling && (
          <motion.div
            key="calling"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-center gap-6"
          >
            <RoundButton
              label="Cancel"
              onClick={onHangUp}
              color="bg-red-600 hover:bg-red-500 text-white"
            >
              <PhoneOff size={26} />
            </RoundButton>
          </motion.div>
        )}

        {/* ── INCOMING CALL ──────────────────────────────────────── */}
        {incoming && (
          <motion.div
            key="incoming"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-center gap-8"
          >
            <RoundButton
              label="Decline"
              onClick={onDecline}
              color="bg-red-600 hover:bg-red-500 text-white"
            >
              <PhoneOff size={26} />
            </RoundButton>
            <RoundButton
              label="Answer"
              onClick={onAnswer}
              color="bg-emerald-600 hover:bg-emerald-500 text-white"
              pulse
            >
              <PhoneIncoming size={26} />
            </RoundButton>
          </motion.div>
        )}

        {/* ── IN CALL ────────────────────────────────────────────── */}
        {inCall && (
          <motion.div
            key="in-call"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-center gap-8"
          >
            <RoundButton
              label={isMuted ? "Unmute" : "Mute"}
              onClick={onToggleMute}
              color={
                isMuted
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "bg-zinc-700 hover:bg-zinc-600 text-white"
              }
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </RoundButton>

            <RoundButton
              label="Hang Up"
              onClick={onHangUp}
              color="bg-red-600 hover:bg-red-500 text-white"
            >
              <PhoneOff size={26} />
            </RoundButton>
          </motion.div>
        )}

        {/* ── NOT REGISTERED ─────────────────────────────────────── */}
        {(callState === "unregistered" ||
          callState === "registering" ||
          callState === "error") && (
          <motion.div
            key="disabled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-6"
          >
            <RoundButton
              label="Call Monto"
              onClick={() => {}}
              color="bg-zinc-700 text-zinc-500"
              disabled
            >
              <Phone size={26} />
            </RoundButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
