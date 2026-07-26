"use client";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { QrCode, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PairingScanner } from "@/components/PairingScanner";
import { loadChildProfile, saveChildProfile, DEFAULT_CHILD } from "@/lib/profile-storage";
import {
  addPairing,
  redeemPairingCode,
  redeemManualPairingCode,
  notifyChildPaired,
  type PairingData,
} from "@/lib/pairing-storage";

/**
 * Scan-or-enter-code pairing UI, shared by the first-ever pairing
 * (CallScreen's PairingPrompt) and adding an additional box (ProfilePanel) —
 * same backend redeem + local save either way. Only asks for the child's
 * name when the shared profile doesn't have one yet, since one profile is
 * shared across every paired box.
 */
export function PairingFlow({ onPaired }: { onPaired: (data: PairingData) => void }) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [manualCode, setManualCode] = useState("");
  // Set once a scan/code redeems successfully but the child's name hasn't
  // been entered yet — holds the pairing until the name modal is confirmed.
  const [pendingPairing, setPendingPairing] = useState<PairingData | null>(null);
  const [childName, setChildName] = useState("");

  const finishPairing = useCallback(
    (data: PairingData, name: string) => {
      addPairing(data);
      toast.success(`Paired! You're connected to ${name}'s Monto box 🎉`);
      notifyChildPaired(data, name);
      onPaired(data);
    },
    [onPaired]
  );

  const afterRedeem = useCallback(
    (data: PairingData) => {
      const existing = loadChildProfile();
      if (existing.name.trim()) {
        finishPairing(data, existing.name.trim());
      } else {
        setPendingPairing(data);
      }
    },
    [finishPairing]
  );

  const handleDetected = useCallback(
    async (raw: string) => {
      setRedeeming(true);
      setScanError(null);
      try {
        const data = await redeemPairingCode(raw);
        setScanning(false);
        afterRedeem(data);
      } catch (err) {
        setScanError(err instanceof Error ? err.message : "Pairing failed — try again.");
        setScanning(false);
      } finally {
        setRedeeming(false);
      }
    },
    [afterRedeem]
  );

  const handleManualCode = useCallback(async () => {
    setRedeeming(true);
    setScanError(null);
    try {
      const data = await redeemManualPairingCode(manualCode);
      afterRedeem(data);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Pairing failed — try again.");
    } finally {
      setRedeeming(false);
    }
  }, [manualCode, afterRedeem]);

  const handleConfirmChildName = useCallback(() => {
    const name = childName.trim();
    if (!name || !pendingPairing) return;
    saveChildProfile({ ...DEFAULT_CHILD, name });
    finishPairing(pendingPairing, name);
    setPendingPairing(null);
    setChildName("");
  }, [childName, pendingPairing, finishPairing]);

  return (
    <div className="flex flex-col items-center gap-5 text-center w-full">
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

      {/* Fallback when the camera can't scan the QR (bad lighting, a
          screen that won't focus, no camera at all) — the child screen
          shows this same 6-character code as plain text below its QR. */}
      <div className="w-full max-w-xs flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex-1 h-px bg-border" />
        or enter the code
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="w-full max-w-xs flex gap-2">
        <Input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleManualCode()}
          placeholder="ABC123"
          maxLength={6}
          className="h-11 rounded-xl text-center tracking-[0.3em] font-bold uppercase"
        />
        <Button
          onClick={handleManualCode}
          disabled={redeeming || manualCode.trim().length !== 6}
          className="h-11 rounded-xl px-5 disabled:opacity-60"
        >
          Pair
        </Button>
      </div>

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
    </div>
  );
}
