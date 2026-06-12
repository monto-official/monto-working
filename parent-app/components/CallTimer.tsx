"use client";
import { formatDuration } from "@/lib/utils";
import type { CallState, CallDirection } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

interface CallTimerProps {
  callState: CallState;
  callDirection: CallDirection | null;
  callDuration: number;
}

export function CallTimer({ callState, callDirection, callDuration }: CallTimerProps) {
  const show = callState === "in-call" || callState === "calling" || callState === "incoming";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="text-center overflow-hidden"
        >
          {callState === "calling" && (
            <p className="text-sm text-zinc-400 animate-pulse">
              📞 Calling Monto…
            </p>
          )}
          {callState === "incoming" && (
            <p className="text-sm text-violet-400 animate-pulse">
              📲 Monto is calling you…
            </p>
          )}
          {callState === "in-call" && (
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">
                {callDirection === "inbound" ? "Incoming call" : "Outgoing call"}
              </p>
              <p className="text-2xl font-mono font-semibold text-white tabular-nums">
                {formatDuration(callDuration)}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
