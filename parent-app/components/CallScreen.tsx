"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneOff, PhoneIncoming, PhoneCall, Mic, MicOff, Clock, QrCode, Unlink, CheckCircle2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import { useDeviceChannel } from "@/hooks/useDeviceChannel";
import { loadChildProfile, loadParentAccount, DEFAULT_CHILD } from "@/lib/profile-storage";
import {
  loadPairings,
  removePairing,
  notifyChildIncomingCall,
  type PairingData,
} from "@/lib/pairing-storage";
import { getOrCreateParentDeviceId } from "@/lib/device-id";
import { loadAuthSession } from "@/lib/auth-storage";
import { getActiveCallDevice, setActiveCallDevice, clearActiveCallDevice } from "@/lib/call-state";
import { PairingFlow } from "@/components/PairingFlow";
import { DeviceSwitcher } from "@/components/DeviceSwitcher";
import { ChildAvatar } from "@/components/ChildAvatar";
import type { ChildProfile } from "@/types";
import { expandTurnUrls } from "@/lib/turn";

interface CallHistoryEntry {
  id: string;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
  status: "ringing" | "connected" | "missed" | "rejected" | "ended";
  caller_role?: "child" | "parent" | null;
}

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
  // undefined = pairings not checked yet
  const [pairings, setPairings] = useState<PairingData[] | undefined>(undefined);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadPairings();
    setPairings(loaded);
    // If a call is already in flight (e.g. IncomingCallRouter sent us here
    // for a ring), land on that device instead of always the first one.
    const active = getActiveCallDevice();
    const preselect = active && loaded.some((p) => p.deviceId === active) ? active : loaded[0]?.deviceId ?? null;
    setSelectedDeviceId(preselect);
  }, []);

  if (pairings === undefined) {
    return (
      <PhoneShell>
        <PageHeader title="Call Monto Box" />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
        <BottomNav />
      </PhoneShell>
    );
  }

  if (pairings.length === 0) {
    return (
      <PairingPrompt
        onPaired={(data) => {
          setPairings([data]);
          setSelectedDeviceId(data.deviceId);
        }}
      />
    );
  }

  const selected = pairings.find((p) => p.deviceId === selectedDeviceId) ?? pairings[0];

  return (
    <ActiveCallScreen
      pairing={selected}
      pairings={pairings}
      onSelectDevice={setSelectedDeviceId}
      onUnpaired={() => {
        const remaining = pairings.filter((p) => p.deviceId !== selected.deviceId);
        setPairings(remaining);
        setSelectedDeviceId(remaining[0]?.deviceId ?? null);
      }}
    />
  );
}

// ── Not paired yet — scan the child device's QR code ─────────────────────────

function PairingPrompt({ onPaired }: { onPaired: (data: PairingData) => void }) {
  return (
    <PhoneShell>
      <PageHeader title="Call Monto Box" />

      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="size-20 rounded-full bg-muted flex items-center justify-center">
          <QrCode className="size-9 text-muted-foreground" />
        </div>

        <div>
          <h2 className="text-lg font-bold">Pair with your Monto box</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Open the Monto app on your child's device, tap the QR icon at the
            top, and scan it here — you only need to do this once.
          </p>
        </div>

        <PairingFlow onPaired={onPaired} />
      </div>

      <BottomNav />
    </PhoneShell>
  );
}

// ── Paired — the actual call screen ───────────────────────────────────────────

function ActiveCallScreen({
  pairing,
  pairings,
  onSelectDevice,
  onUnpaired,
}: {
  pairing: PairingData;
  pairings: PairingData[];
  onSelectDevice: (deviceId: string) => void;
  onUnpaired: () => void;
}) {
  const { online: deviceOnline } = useDeviceChannel(pairing);
  const [child, setChild] = useState<ChildProfile>(DEFAULT_CHILD);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [confirmUnpair, setConfirmUnpair] = useState(false);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch(`${pairing.apiUrl}/call/${encodeURIComponent(pairing.deviceId)}/history?limit=50`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { calls?: CallHistoryEntry[] };
      setCallHistory(data.calls ?? []);
    } catch {
      // Calling must remain usable if history is temporarily unavailable.
    } finally {
      setHistoryLoading(false);
    }
  }, [pairing.apiUrl, pairing.deviceId]);

  useEffect(() => {
    setChild(loadChildProfile());
    void refreshHistory();
  }, [refreshHistory]);

  // Signaling is HTTP polling now (see routes/call_signal.py) — pairing.apiUrl
  // is already a plain http(s) base URL, no ws:// conversion needed.
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    ...(pairing.turnUrl
      ? [{ urls: expandTurnUrls(pairing.turnUrl), username: pairing.turnUsername, credential: pairing.turnPassword }]
      : []),
  ];

  const { status, isMuted, durationFormatted, peerOnline, error,
          ringParent, acceptCall, rejectCall, hangUp, toggleMute } = useWebRTCCall({
    role: "parent",
    apiUrl: pairing.apiUrl,
    room: pairing.deviceId,
    iceServers,
  });

  const isIncoming  = status === "incoming";
  const isActive    = status === "in-call";
  const isConnecting = status === "connecting";
  const isReady     = status === "ready";
  const label = error || STATUS_LABEL[status] || status;

  useEffect(() => {
    if (status !== "ended" && status !== "ready") return;
    const timer = setTimeout(() => void refreshHistory(), 500);
    return () => clearTimeout(timer);
  }, [status, refreshHistory]);

  // Ring for as long as the child's call is waiting on this side to
  // accept/reject — stops the moment that resolves either way.
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (isIncoming) {
      const ringtone = new Audio("/sounds/call_ringtone.mp3");
      ringtone.loop = true;
      ringtone.play().catch(() => {});
      ringtoneRef.current = ringtone;
      return () => {
        ringtone.pause();
        if (ringtoneRef.current === ringtone) ringtoneRef.current = null;
      };
    }
  }, [isIncoming]);

  // ── Parent-initiated call ────────────────────────────────────────────────
  // The child app has no persistent listener on the WebRTC call room while
  // it's idle, so ring it over the always-on control channel first (wakes its
  // own CallScreen open there) and wait for `peer-online` before sending the
  // real `ring` signal — otherwise it'd be relayed into an empty room and
  // dropped.
  const [pendingRing, setPendingRing] = useState(false);
  const pendingRingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wakeChild = useCallback(() => {
    const account = loadParentAccount();
    notifyChildIncomingCall(pairing, account.name || "Your parent", account.avatar);
  }, [pairing]);

  useEffect(() => {
    if (!pendingRing || peerOnline || status !== "ready") return;
    wakeChild();
    const retry = setInterval(wakeChild, 3000);
    return () => clearInterval(retry);
  }, [pendingRing, peerOnline, status, wakeChild]);

  // Retries every 2s rather than sending once — the signaling socket has
  // been observed to briefly recycle every ~3s under some networks, which
  // can silently drop a single one-shot send; retrying gives it more
  // chances to land in a stable window. Stops as soon as `status` moves
  // past "ready" (the child acknowledged and the call is progressing).
  useEffect(() => {
    if (!(pendingRing && peerOnline)) return;
    if (status !== "ready") {
      if (pendingRingTimeoutRef.current) clearTimeout(pendingRingTimeoutRef.current);
      setPendingRing(false);
      return;
    }
    ringParent();
    const retry = setInterval(ringParent, 2000);
    return () => clearInterval(retry);
  }, [pendingRing, peerOnline, status, ringParent]);

  useEffect(() => () => {
    if (pendingRingTimeoutRef.current) clearTimeout(pendingRingTimeoutRef.current);
  }, []);

  // Tracks which device's call is "busy" for IncomingCallRouter: any device
  // whose call is ringing/connecting/active/being called out to holds the
  // flag; releasing it as soon as the call is no longer in flight lets a
  // ring from a *different* box through instead of being treated as busy.
  useEffect(() => {
    const inFlight = isIncoming || isConnecting || isActive || pendingRing;
    if (inFlight) setActiveCallDevice(pairing.deviceId);
    else clearActiveCallDevice(pairing.deviceId);
  }, [isIncoming, isConnecting, isActive, pendingRing, pairing.deviceId]);

  const handleCallChild = useCallback(() => {
    if (!isReady || pendingRing) return;
    wakeChild();
    setPendingRing(true);
    pendingRingTimeoutRef.current = setTimeout(() => {
      setPendingRing(false);
      toast.error("Child's Monto box didn't respond — make sure it's on and connected.");
    }, 45000);
  }, [isReady, pendingRing, wakeChild]);

  const cancelPendingCall = useCallback(() => {
    if (pendingRingTimeoutRef.current) clearTimeout(pendingRingTimeoutRef.current);
    pendingRingTimeoutRef.current = null;
    setPendingRing(false);
  }, []);

  const canSwitchOrUnpair = !isIncoming && !isConnecting && !isActive && !pendingRing;

  const handleUnpair = useCallback(async () => {
    setConfirmUnpair(false);
    try {
      const session = loadAuthSession();
      await fetch(`${pairing.apiUrl}/pairing/${encodeURIComponent(pairing.deviceId)}/${encodeURIComponent(getOrCreateParentDeviceId())}`, {
        method: "DELETE",
        headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
      });
    } catch {
      // Best-effort on the backend — remove it locally either way so the
      // parent isn't stuck with a stale box they no longer have.
    }
    removePairing(pairing.deviceId);
    toast.success("Unpaired from that Monto box.");
    onUnpaired();
  }, [pairing.apiUrl, pairing.deviceId, onUnpaired]);

  return (
    <PhoneShell>
      <PageHeader
        title="Call Monto Box"
        right={
          canSwitchOrUnpair && (
            <button onClick={() => setConfirmUnpair(true)} aria-label="Unpair this Monto box">
              <Unlink className="size-4 text-muted-foreground" />
            </button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6">

        {canSwitchOrUnpair && (
          <DeviceSwitcher pairings={pairings} selectedDeviceId={pairing.deviceId} onChange={onSelectDevice} />
        )}

        {/* Status card */}
        <div className="rounded-3xl soft-gradient p-8 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 brand-gradient opacity-10" />

          {/* Avatar */}
          <div className={`size-24 rounded-full brand-gradient text-white flex items-center justify-center text-3xl shadow-elevated relative ${isIncoming ? "animate-pulse" : ""}`}>
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
              <ChildAvatar child={child} />
            </div>
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
          <div className={`mt-3 flex items-center gap-1.5 text-xs relative ${deviceOnline ? "text-green-500" : "text-muted-foreground"}`}>
            <span className={`size-2 rounded-full ${deviceOnline ? "bg-green-500" : "bg-gray-400"}`} />
            {deviceOnline ? "Child device online" : "Child device offline"}
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
          ) : pendingRing ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="size-20 rounded-full brand-gradient flex items-center justify-center animate-pulse">
                <PhoneCall className="size-8 text-white" />
              </div>
              <p className="text-xs text-muted-foreground max-w-xs">
                {peerOnline ? "Child device found. Starting secure audio…" : `Waking up ${child.name ? `${child.name}'s` : "your child's"} Monto box…`}
              </p>
              <button onClick={cancelPendingCall}
                className="rounded-full border px-5 py-2 text-sm font-semibold text-muted-foreground active:scale-95 transition">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <button onClick={handleCallChild}
                disabled={!isReady}
                className="size-20 rounded-full brand-gradient text-white shadow-elevated flex items-center justify-center active:scale-95 transition disabled:opacity-40"
                aria-label="Call child">
                <PhoneCall className="size-8" />
              </button>
              <p className="text-xs text-muted-foreground max-w-xs">
                Tap to call {child.name ? `${child.name}'s` : "your child's"} Monto box, or
                just wait — when your child says "call mom" or "call dad" you'll get the call here.
              </p>
            </div>
          )}
        </div>

        {/* Complete call history */}
        <section className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div>
              <h3 className="font-bold">Call history</h3>
              <p className="text-xs text-muted-foreground">Incoming, outgoing and missed calls</p>
            </div>
            <button onClick={() => void refreshHistory()} className="size-9 rounded-full bg-muted flex items-center justify-center" aria-label="Refresh call history">
              <Clock className="size-4" />
            </button>
          </div>
          <div className="divide-y max-h-72 overflow-y-auto">
            {historyLoading ? (
              <p className="p-5 text-sm text-muted-foreground text-center">Loading call history...</p>
            ) : callHistory.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground text-center">No calls yet. Your calls will appear here.</p>
            ) : callHistory.map((call) => {
              const outgoing = call.caller_role === "parent";
              const seconds = call.duration_seconds ?? 0;
              const durationText = seconds > 0 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : "Not connected";
              const statusText = call.status === "ended" ? "Completed" : call.status.charAt(0).toUpperCase() + call.status.slice(1);
              return (
                <div key={call.id} className="p-4 flex items-center gap-3">
                  <div className={`size-10 rounded-full flex items-center justify-center ${call.status === "missed" || call.status === "rejected" ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
                    {outgoing ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{outgoing ? `You called ${child.name || "Monto"}` : `${child.name || "Monto"} called you`}</p>
                    <p className="text-xs text-muted-foreground">{new Date(call.started_at).toLocaleString()} / {durationText}</p>
                  </div>
                  <span className={`text-[11px] font-semibold ${call.status === "missed" || call.status === "rejected" ? "text-red-500" : "text-green-600"}`}>{statusText}</span>
                </div>
              );
            })}
          </div>
        </section>

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

      <Modal open={confirmUnpair} onClose={() => setConfirmUnpair(false)}>
        <div className="flex flex-col items-center text-center gap-2 mb-4">
          <CheckCircle2 className="size-10 text-muted-foreground" />
          <h2 className="text-lg font-bold">Unpair this Monto box?</h2>
          <p className="text-sm text-muted-foreground">
            You'll stop receiving calls and messages from it. You can pair with it again later.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setConfirmUnpair(false)} className="flex-1 h-11 rounded-2xl">
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleUnpair} className="flex-1 h-11 rounded-2xl">
            Unpair
          </Button>
        </div>
      </Modal>

      <BottomNav />
    </PhoneShell>
  );
}
