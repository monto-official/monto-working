"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneOff, PhoneIncoming, PhoneCall, Mic, MicOff, Phone, Clock, QrCode, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import { useDeviceChannel } from "@/hooks/useDeviceChannel";
import { loadChildProfile, saveChildProfile, DEFAULT_CHILD, loadParentAccount } from "@/lib/profile-storage";
import {
  loadPairing,
  savePairing,
  clearPairing,
  redeemPairingCode,
  notifyChildPaired,
  notifyChildIncomingCall,
  type PairingData,
} from "@/lib/pairing-storage";
import { PairingScanner } from "@/components/PairingScanner";
import { ChildAvatar } from "@/components/ChildAvatar";
import type { ChildProfile } from "@/types";

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
  // undefined = pairing not checked yet, null = checked and none saved
  const [pairing, setPairing] = useState<PairingData | null | undefined>(undefined);

  useEffect(() => {
    setPairing(loadPairing());
  }, []);

  if (pairing === undefined) {
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

  if (pairing === null) {
    return <PairingPrompt onPaired={setPairing} />;
  }

  return (
    <ActiveCallScreen
      pairing={pairing}
      onRepair={() => {
        clearPairing();
        setPairing(null);
      }}
    />
  );
}

// ── Not paired yet — scan the child device's QR code ─────────────────────────

function PairingPrompt({ onPaired }: { onPaired: (data: PairingData) => void }) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  // Set once a QR scan redeems successfully but the child's name hasn't been
  // entered yet — holds the pairing data until the name modal is confirmed.
  const [pendingPairing, setPendingPairing] = useState<PairingData | null>(null);
  const [childName, setChildName] = useState("");

  const finishPairing = useCallback(
    (data: PairingData, name: string) => {
      toast.success(`Pairing successful! You're connected to ${name}'s Monto box 🎉`);
      notifyChildPaired(data, name);
      onPaired(data);
    },
    [onPaired]
  );

  const handleDetected = useCallback(
    async (raw: string) => {
      setRedeeming(true);
      setScanError(null);
      try {
        const data = await redeemPairingCode(raw);
        savePairing(data);
        setScanning(false);

        const existing = loadChildProfile();
        if (existing.name.trim()) {
          finishPairing(data, existing.name.trim());
        } else {
          // Child's name is required before we show the paired dashboard.
          setPendingPairing(data);
        }
      } catch (err) {
        setScanError(err instanceof Error ? err.message : "Pairing failed — try again.");
        setScanning(false);
      } finally {
        setRedeeming(false);
      }
    },
    [finishPairing]
  );

  const handleConfirmChildName = useCallback(() => {
    const name = childName.trim();
    if (!name || !pendingPairing) return;
    saveChildProfile({ ...DEFAULT_CHILD, name });
    finishPairing(pendingPairing, name);
    setPendingPairing(null);
    setChildName("");
  }, [childName, pendingPairing, finishPairing]);

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

        {scanError && <p className="text-sm text-red-500">{scanError}</p>}

        <button
          onClick={() => {
            setScanError(null);
            setScanning(true);
          }}
          disabled={redeeming}
          className="h-12 px-6 rounded-2xl brand-gradient text-white font-semibold flex items-center gap-2 disabled:opacity-60"
        >
          <QrCode className="size-5" /> {redeeming ? "Pairing..." : "Scan QR Code"}
        </button>
      </div>

      <BottomNav />

      {scanning && (
        <PairingScanner onDetected={handleDetected} onClose={() => setScanning(false)} />
      )}

      <Modal open={pendingPairing !== null} onClose={() => {}}>
        <div className="flex flex-col items-center text-center gap-2 mb-4">
          <CheckCircle2 className="size-10 text-green-500" />
          <h2 className="text-lg font-bold">Pairing successful!</h2>
          <p className="text-sm text-muted-foreground">
            One last step — what's your child's name? It'll be shown across the app.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Child's Name
          </Label>
          <Input
            autoFocus
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirmChildName()}
            placeholder="e.g. Aarav Sharma"
            className="h-11 rounded-xl"
          />
        </div>
        <Button
          onClick={handleConfirmChildName}
          disabled={!childName.trim()}
          className="w-full h-11 rounded-2xl mt-5 disabled:opacity-60"
        >
          Continue
        </Button>
      </Modal>
    </PhoneShell>
  );
}

// ── Paired — the actual call screen ───────────────────────────────────────────

function ActiveCallScreen({
  pairing,
  onRepair,
}: {
  pairing: PairingData;
  onRepair: () => void;
}) {
  const { online: deviceOnline } = useDeviceChannel(pairing);
  const [child, setChild] = useState<ChildProfile>(DEFAULT_CHILD);

  useEffect(() => {
    setChild(loadChildProfile());
  }, []);

  // Signaling is HTTP polling now (see routes/call_signal.py) — pairing.apiUrl
  // is already a plain http(s) base URL, no ws:// conversion needed.
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    ...(pairing.turnUrl
      ? [{ urls: pairing.turnUrl, username: pairing.turnUsername, credential: pairing.turnPassword }]
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

  const handleCallChild = useCallback(() => {
    if (!isReady || pendingRing) return;
    const account = loadParentAccount();
    notifyChildIncomingCall(pairing, account.name || "Your parent", account.avatar);
    setPendingRing(true);
    // Give the child device a full 2 minutes to wake up and come online
    // before giving up — flaky wifi/reconnects shouldn't cut this short.
    pendingRingTimeoutRef.current = setTimeout(() => {
      setPendingRing(false);
      toast.error("Child's Monto box didn't respond — make sure it's on and connected.");
    }, 120000);
  }, [isReady, pendingRing, pairing]);

  return (
    <PhoneShell>
      <PageHeader
        title="Call Monto Box"
        right={
          <button onClick={onRepair} aria-label="Pair with a different Monto box">
            <RefreshCw className="size-4 text-muted-foreground" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6">

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
                Waking up {child.name ? `${child.name}'s` : "your child's"} Monto box…
              </p>
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


