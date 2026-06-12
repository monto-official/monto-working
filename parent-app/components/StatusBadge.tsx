"use client";
import { cn } from "@/lib/utils";
import type { CallState } from "@/types";

const STATE_CONFIG: Record<
  CallState,
  { label: string; color: string; dot: string }
> = {
  unregistered: {
    label: "Disconnected",
    color: "text-zinc-400",
    dot: "bg-zinc-500",
  },
  registering: {
    label: "Connecting…",
    color: "text-amber-400",
    dot: "bg-amber-400 animate-pulse",
  },
  registered: {
    label: "Ready",
    color: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  calling: {
    label: "Calling Monto…",
    color: "text-blue-400",
    dot: "bg-blue-400 animate-pulse",
  },
  incoming: {
    label: "Incoming Call",
    color: "text-violet-400",
    dot: "bg-violet-400 animate-pulse",
  },
  "in-call": {
    label: "On Call",
    color: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  ending: {
    label: "Ending…",
    color: "text-zinc-400",
    dot: "bg-zinc-400 animate-pulse",
  },
  error: {
    label: "Error",
    color: "text-red-400",
    dot: "bg-red-500",
  },
};

interface StatusBadgeProps {
  state: CallState;
  className?: string;
}

export function StatusBadge({ state, className }: StatusBadgeProps) {
  const cfg = STATE_CONFIG[state];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("h-2 w-2 rounded-full flex-shrink-0", cfg.dot)} />
      <span className={cn("text-sm font-medium", cfg.color)}>{cfg.label}</span>
    </div>
  );
}
