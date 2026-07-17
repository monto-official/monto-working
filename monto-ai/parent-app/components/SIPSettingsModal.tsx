"use client";
import { useState } from "react";
import { Settings } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SIPConfig } from "@/types";

interface SIPSettingsModalProps {
  config: SIPConfig;
  onSave: (config: SIPConfig) => void;
}

export function SIPSettingsModal({ config, onSave }: SIPSettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SIPConfig>(config);

  const handleOpen = () => {
    setDraft(config);
    setOpen(true);
  };

  const handleSave = () => {
    onSave(draft);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="SIP settings"
        className="size-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition"
      >
        <Settings size={18} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-bold mb-5">SIP / Asterisk Settings</h2>

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

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 h-11 rounded-2xl">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 h-11 rounded-2xl">
            Save & Reconnect
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          Settings are saved in your browser for this device.
        </p>
      </Modal>
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
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
        className="h-11 rounded-xl"
      />
    </div>
  );
}
