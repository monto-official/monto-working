"use client";
import { useState } from "react";
import { X, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SIPConfig } from "@/types";

interface SIPSettingsModalProps {
  config: SIPConfig;
  onSave: (config: SIPConfig) => void;
}

export function SIPSettingsModal({ config, onSave }: SIPSettingsModalProps) {
  const [open, setOpen]   = useState(false);
  const [draft, setDraft] = useState<SIPConfig>(config);

  const handleSave = () => {
    onSave(draft);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        aria-label="SIP settings"
      >
        <Settings size={16} />
        SIP Settings
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/70 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            {/* Modal */}
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-50 px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-md rounded-2xl bg-monto-card border border-monto-border p-6 shadow-2xl"
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white">SIP / Asterisk Settings</h2>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Form */}
                <div className="flex flex-col gap-4">
                  <Field
                    label="WebSocket URL"
                    hint="e.g. ws://192.168.1.10:8088/ws"
                    value={draft.wsUrl}
                    onChange={(v) => setDraft((d) => ({ ...d, wsUrl: v }))}
                  />
                  <Field
                    label="SIP Domain / Asterisk Host"
                    hint="e.g. 192.168.1.10"
                    value={draft.domain}
                    onChange={(v) => setDraft((d) => ({ ...d, domain: v }))}
                  />
                  <Field
                    label="Username"
                    hint="Your parent SIP extension (e.g. parent)"
                    value={draft.username}
                    onChange={(v) => setDraft((d) => ({ ...d, username: v }))}
                  />
                  <Field
                    label="Password"
                    hint="SIP account password"
                    value={draft.password}
                    type="password"
                    onChange={(v) => setDraft((d) => ({ ...d, password: v }))}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-xl border border-monto-border py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 rounded-xl bg-monto-purple py-2.5 text-sm font-semibold text-white hover:bg-purple-600 transition-colors"
                  >
                    Save & Reconnect
                  </button>
                </div>

                <p className="mt-4 text-xs text-zinc-600 text-center">
                  Settings are saved in your browser for this session.
                </p>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
        className="rounded-lg bg-monto-dark border border-monto-border px-3 py-2 text-sm text-zinc-200
                   placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-monto-purple"
      />
    </label>
  );
}
