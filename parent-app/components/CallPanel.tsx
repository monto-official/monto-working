"use client";
/**
 * CallPanel — the main calling interface between parent and the Monto AI box.
 * Renders the avatar, status, call controls, timer, and call log.
 */
import { useCallback, useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { useSIP } from "@/hooks/useSIP";
import { StatusBadge } from "./StatusBadge";
import { MontoAvatar } from "./MontoAvatar";
import { CallControls } from "./CallControls";
import { CallTimer } from "./CallTimer";
import { CallLog } from "./CallLog";
import { SIPSettingsModal } from "./SIPSettingsModal";
import type { SIPConfig } from "@/types";

// ── Default SIP config from env vars ─────────────────────────────────────────
const DEFAULT_CONFIG: SIPConfig = {
  wsUrl:    process.env.NEXT_PUBLIC_ASTERISK_WS_URL  || "ws://localhost:8088/ws",
  username: process.env.NEXT_PUBLIC_SIP_USERNAME     || "parent",
  password: process.env.NEXT_PUBLIC_SIP_PASSWORD     || "parentpass123",
  domain:   process.env.NEXT_PUBLIC_SIP_DOMAIN       || "localhost",
};

const CONFIG_STORAGE_KEY = "monto_sip_config";

function loadConfig(): SIPConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

function saveConfig(cfg: SIPConfig) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CallPanel() {
  const [sipConfig, setSipConfig] = useState<SIPConfig>(DEFAULT_CONFIG);

  // Load saved config on mount
  useEffect(() => {
    setSipConfig(loadConfig());
  }, []);

  const {
    callState,
    callDirection,
    callDuration,
    callLog,
    remoteAudioRef,
    isMuted,
    callMonto,
    answerCall,
    declineCall,
    hangUp,
    toggleMute,
    reconnect,
    clearLog,
  } = useSIP(sipConfig);

  const handleSaveConfig = useCallback(
    (cfg: SIPConfig) => {
      setSipConfig(cfg);
      saveConfig(cfg);
      reconnect();
    },
    [reconnect]
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white tracking-tight">
          Monto Parent
        </h1>
        <div className="flex items-center gap-3">
          <StatusBadge state={callState} />
          {callState === "error" && (
            <button
              onClick={reconnect}
              title="Retry connection"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Avatar card ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-monto-border bg-monto-card flex flex-col items-center py-10 gap-4 px-6">
        <MontoAvatar callState={callState} size={120} />

        {/* Call timer / status text */}
        <div className="mt-8">
          <CallTimer
            callState={callState}
            callDirection={callDirection}
            callDuration={callDuration}
          />
        </div>
      </div>

      {/* ── Call controls ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-monto-border bg-monto-card px-6 py-4">
        <CallControls
          callState={callState}
          isMuted={isMuted}
          onCall={callMonto}
          onAnswer={answerCall}
          onDecline={declineCall}
          onHangUp={hangUp}
          onToggleMute={toggleMute}
        />
      </div>

      {/* ── Call log ──────────────────────────────────────────────────────────── */}
      <CallLog entries={callLog} onClear={clearLog} />

      {/* ── Footer: SIP settings ─────────────────────────────────────────────── */}
      <div className="flex justify-center pb-2">
        <SIPSettingsModal config={sipConfig} onSave={handleSaveConfig} />
      </div>

      {/* Hidden audio element — receives remote (Monto) audio stream */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={remoteAudioRef} autoPlay playsInline aria-hidden="true" />
    </div>
  );
}
