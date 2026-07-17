"use client";
import { useEffect } from "react";
import { PhoneOff, PhoneIncoming, Mic, MicOff, Phone, Clock } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import { loadChildProfile, DEFAULT_CHILD } from "@/lib/profile-storage";
import { useState } from "react";
import type { ChildProfile } from "@/types";

const SIGNALING_URL =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    .replace(/^http/, "ws") + "/ws/call";

const STATUS_LABEL: Record<string, string> = {
  idle:            "Starting...",
  "connecting-ws": "Connecting...",
  ready:           "Waiting for child to call",
  ringing:         "Ringing...",
  incoming:        "Incoming call from child!",
  connecting:      "Connecting...",
  "in-call":       "Connected",
  ended:           "Call ended",
  error:           "Connection error",
};

export function CallScreen() {
  const [child, setChild] = useState<ChildProfile>(DEFAULT_CHILD);

  useEffect(() => { setChild(loadChildProfile()); }, []);

  const { status, isMuted, durationFormatted, peerOnline, error,
          acceptCall, rejectCall, hangUp, toggleMute } = useWebRTCCall({
    role: "parent",
    signalingUrl: SIGNALING_URL,
  });

  const isIncoming  = status === "incoming";
  const isActive    = status === "in-call";
  const isConnecting = status === "connecting";
  const label = error || STATUS_LABEL[status] || status;

  return (
    <PhoneShell>
      <PageHeader title="Call Monto Box" />

      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6">

        {/* Status card */}
        <div className="rounded-3xl soft-gradient p-8 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 brand-gradient opacity-10" />

          {/* Avatar */}
          <div className={`size-24 rounded-full brand-gradient text-white flex items-center justify-center text-3xl shadow-elevated relative ${isIncoming ? "animate-pulse" : ""}`}>
            {child.avatar || "👦"}
            {isActive && (
              <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-green-400 border-2 border-white" />
            )}
          </div>

          <h2 className="mt-4 text-xl font-bold relative">
            {child.name ? `${child.name}'s Monto` : "Monto Box"}
          </h2>

          <p className={`text-sm font-semibold mt-1 relative ${
            isActive ? "text-green-500" :
            isIncoming ? "text-purple-500" :
            status === "error" ? "text-red-500" :
            "text-muted-foreground"
          }`}>
            {label}
          </p>

          {isActive && (
            <p className="text-sm font-mono font-bold text-primary mt-1 relative">
              {durationFormatted}
            </p>
          )}

          {/* Peer status */}
          <div className={`mt-3 flex items-center gap-1.5 text-xs relative ${peerOnline ? "text-green-500" : "text-muted-foreground"}`}>
            <span className={`size-2 rounded-full ${peerOnline ? "bg-green-500" : "bg-gray-400"}`} />
            {peerOnline ? "Child device online" : "Child device offline"}
          </div>
        </div>

        {/* Call controls */}
        <div className="flex items-center justify-center gap-6 py-4">
          {isIncoming ? (
            <>
              {/* Reject */}
              <button onClick={rejectCall}
                className="size-16 rounded-full bg-red-500 text-white shadow-elevated flex items-center justify-center active:scale-95 transition"
                aria-label="Reject">
                <PhoneOff className="size-6" />
              </button>
              {/* Accept */}
              <button onClick={acceptCall}
                className="size-20 rounded-full brand-gradient text-white shadow-elevated flex items-center justify-center active:scale-95 transition animate-bounce"
                aria-label="Accept">
                <PhoneIncoming className="size-8" />
              </button>
            </>
          ) : (isActive || isConnecting) ? (
            <>
              {isActive && (
                <button onClick={toggleMute}
                  className={`size-14 rounded-full border-2 flex items-center justify-center ${isMuted ? "bg-muted" : "bg-card"}`}
                  aria-label={isMuted ? "Unmute" : "Mute"}>
                  {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                </button>
              )}
              <button onClick={hangUp}
                className="size-20 rounded-full bg-red-500 text-white shadow-elevated flex items-center justify-center active:scale-95 transition"
                aria-label="Hang Up">
                <PhoneOff className="size-7" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="size-20 rounded-full bg-muted flex items-center justify-center">
                <Phone className="size-8 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground max-w-xs">
                Keep this page open. When your child says "call mom" or "call dad",
                you'll receive the call here.
              </p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="size-4" /> How it works
          </p>
          <p>1. Keep this page open on your phone or browser.</p>
          <p>2. Your child says <strong>"Hey Monto, call mom"</strong> or <strong>"call dad"</strong>.</p>
          <p>3. You'll see an incoming call here — tap the green button to answer.</p>
          <p>4. Both sides can speak and hear each other in real time.</p>
        </div>
      </div>

      <BottomNav />
    </PhoneShell>
  );
}
