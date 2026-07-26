"use client";
import { useEffect, useState } from "react";
import { loadPairings, type PairingData } from "@/lib/pairing-storage";

/** Loads every paired box and tracks which one a single-device screen
 * (Reminders, Bedtime, Questions) is currently showing — defaults to the
 * first paired box. `pairings` is `undefined` while still loading, so
 * callers can tell "loading" apart from "nothing paired" (empty array). */
export function useSelectedPairing() {
  const [pairings, setPairings] = useState<PairingData[] | undefined>(undefined);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadPairings();
    setPairings(loaded);
    setSelectedDeviceId(loaded[0]?.deviceId ?? null);
  }, []);

  const selected = pairings?.find((p) => p.deviceId === selectedDeviceId) ?? pairings?.[0] ?? null;

  return { pairings, selected, selectedDeviceId, setSelectedDeviceId };
}
