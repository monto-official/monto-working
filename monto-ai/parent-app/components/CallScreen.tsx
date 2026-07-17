"use client";
/**
 * CallScreen — real calling interface between parent and the Monto AI box,
 * styled to match the rest of the app's dashboard look. VoIP is handled by
 * Asterisk + JsSIP (WebRTC over WebSocket) via useSIP.
 */
import { useCallback, useEffect, useState } from "react";
import { Mic, MicOff, Phone, PhoneIncoming, PhoneOff, Clock, RefreshCw } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { SIPSettingsModal } from "@/components/SIPSettingsModal";
import { useSIP } from "@/hooks/useSIP";
import { formatDate, formatDuration } from "@/lib/utils";
import { loadChildProfile, DEFAULT_CHILD } from "@/lib/profile-storage";
import type { ChildProfile, SIPConfig } from "@/types";

const DEFAULT_CONFIG: SIPConfig = {
  wsUrl: process.env.NEXT_PUBLIC_ASTERISK_WS_URL || "ws://localhost:8088/ws",
  username: process.env.NEXT_PUBLIC_SIP_USERNAME || "parent",
  password: process.env.NEXT_PUBLIC_SIP_PASSWORD || "parentpass123",
  domain: process.env.NEXT_PUBLIC_SIP_DOMAIN || "localhost",
};

const CONFIG_STORAGE_KEY = "monto_sip_config";

function loadConfig(): SIPConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_CONFIG;
}

function saveConfig(cfg: SIPConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

const STATE_LABEL: Record<string, string> = {
  unregistered: "Disconnected",
  registering: "Connecting…",
  registered: "Ready to Call",
  calling: "Calling…",
  incoming: "Incoming Call",
  "in-call": "Connected",
  ending: "Ending…",
  error: "Connection Error",
};

export function CallScreen() {
  const [sipConfig, setSipConfig] = useState<SIPConfig>(DEFAULT_CONFIG);
  const [child, setChild] = useState<ChildProfile>(DEFAULT_CHILD);

  useEffect(() => {
    setSipConfig(loadConfig());
    setChild(loadChildProfile());
  }, []);

  const {
    callState,
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
  } = useSIP(sipConfig);

  const handleSaveConfig = useCallback(
    (cfg: SIPConfig) => {
      setSipConfig(cfg);
      saveConfig(cfg);
      reconnect();
    },
    [reconnect]
  );

  const label = STATE_LABEL[callState] ?? callState;
  const sub =
    callState === "in-call"
      ? formatDuration(callDuration)
      : callState === "calling"
        ? "Connecting to AI Box"
        : callState === "incoming"
          ? "Tap answer to pick up"
          : callState === "registered"
            ? "Tap to start a call"
            : callState === "registering"
              ? "Connecting to Asterisk…"
              : "Check SIP settings";

  const canCall = callState === "registered";
  const isIncoming = callState === "incoming";
  const isActive = callState === "in-call";
  const isDialing = callState === "calling";

  return (
    <PhoneShell>
      <PageHeader
        title="Call AI Box"
        right={
          <div className="flex items-center gap-1">
            {callState === "error" && (
              <button
                onClick={reconnect}
                aria-label="Retry connection"
                className="size-9 rounded-full bg-muted flex items-center justify-center text-destructive"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <SIPSettingsModal config={sipConfig} onSave={handleSaveConfig} />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col">
        <div className="rounded-3xl soft-gradient p-8 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 brand-gradient opacity-10" />
          <div className="size-24 rounded-full brand-gradient text-white flex items-center justify-center text-3xl shadow-elevated relative">
            {child.avatar || "👦"}
            {isActive && (
              <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-success border-2 border-white" />
            )}
          </div>
          <h2 className="mt-4 text-xl font-bold relative">
            {child.name ? `${child.name}'s Monto Box` : "Monto Box"}
          </h2>
          <p className="text-sm text-muted-foreground relative">{label}</p>
          <p
            className={`mt-1 text-sm font-mono font-semibold relative ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {sub}
          </p>

          {isDialing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="size-48 rounded-full border-2 border-primary/30 animate-ping" />
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center py-8">
          {isIncoming ? (
            <div className="flex items-center gap-8">
              <button
                onClick={declineCall}
                className="size-16 rounded-full bg-destructive text-white shadow-elevated flex items-center justify-center active:scale-95 transition"
                aria-label="Decline"
              >
                <PhoneOff className="size-6" />
              </button>
              <button
                onClick={answerCall}
                className="size-20 rounded-full brand-gradient text-white shadow-elevated flex items-center justify-center active:scale-95 transition animate-pulse"
                aria-label="Answer"
              >
                <PhoneIncoming className="size-8" />
              </button>
            </div>
          ) : isActive || isDialing ? (
            <div className="flex items-center gap-5">
              {isActive && (
                <button
                  onClick={toggleMute}
                  className={`size-14 rounded-full border-2 flex items-center justify-center ${
                    isMuted ? "bg-muted" : "bg-card"
                  }`}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                </button>
              )}
              <button
                onClick={hangUp}
                className="size-20 rounded-full bg-destructive text-white shadow-elevated flex items-center justify-center active:scale-95 transition"
                aria-label={isDialing ? "Cancel" : "Hang Up"}
              >
                <PhoneOff className="size-7" />
              </button>
            </div>
          ) : (
            <button
              onClick={callMonto}
              disabled={!canCall}
              className="size-24 rounded-full brand-gradient text-white shadow-elevated flex items-center justify-center active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Call Monto"
            >
              <Phone className="size-8" />
            </button>
          )}
        </div>

        <div>
          <h3 className="font-bold mb-3 px-1 flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" /> Recent Calls
          </h3>
          {callLog.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No calls yet.</p>
          ) : (
            <div className="space-y-2">
              {callLog.map((c) => (
                <div key={c.id} className="rounded-2xl bg-card border p-3 flex items-center gap-3 shadow-card">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Phone className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {c.direction === "inbound" ? "From Monto" : "To Monto"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(c.startedAt)} • {c.status}
                    </p>
                  </div>
                  {c.durationSeconds !== undefined && c.durationSeconds > 0 && (
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatDuration(c.durationSeconds)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hidden audio element — receives remote (Monto) audio stream */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={remoteAudioRef} autoPlay playsInline aria-hidden="true" />

      <BottomNav />
    </PhoneShell>
  );
}
