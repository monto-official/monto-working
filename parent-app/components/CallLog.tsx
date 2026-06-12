"use client";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Trash2 } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/utils";
import type { CallLogEntry } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

interface CallLogProps {
  entries: CallLogEntry[];
  onClear: () => void;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  answered: <PhoneIncoming size={14} className="text-emerald-400" />,
  missed:   <PhoneMissed   size={14} className="text-red-400" />,
  declined: <PhoneOutgoing size={14} className="text-amber-400" />,
  failed:   <PhoneMissed   size={14} className="text-red-500" />,
};

const STATUS_COLOR: Record<string, string> = {
  answered: "text-emerald-400",
  missed:   "text-red-400",
  declined: "text-amber-400",
  failed:   "text-red-500",
};

export function CallLog({ entries, onClear }: CallLogProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Call History
        </h3>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            aria-label="Clear call history"
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <p className="text-center text-sm text-zinc-600 py-6">No calls yet.</p>
      )}

      {/* Log entries */}
      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-center gap-3 rounded-xl bg-monto-card border border-monto-border px-4 py-3"
          >
            {/* Direction + Status icon */}
            <div className="flex-shrink-0">
              {entry.direction === "inbound" ? (
                <PhoneIncoming size={16} className="text-violet-400" />
              ) : (
                <PhoneOutgoing size={16} className="text-blue-400" />
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200">
                {entry.direction === "inbound" ? "From Monto" : "To Monto"}
              </p>
              <p className="text-xs text-zinc-500">
                {formatDate(entry.startedAt)}
              </p>
            </div>

            {/* Status + duration */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                {STATUS_ICON[entry.status]}
                <span className={`text-xs ${STATUS_COLOR[entry.status]}`}>
                  {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                </span>
              </div>
              {entry.durationSeconds !== undefined && entry.durationSeconds > 0 && (
                <span className="text-xs text-zinc-600 font-mono">
                  {formatDuration(entry.durationSeconds)}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
