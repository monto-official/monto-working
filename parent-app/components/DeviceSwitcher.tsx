"use client";
import { cn } from "@/lib/utils";
import type { PairingData } from "@/lib/pairing-storage";

/** Lets a parent pick which paired Monto box a screen's data/actions apply
 * to. Renders nothing when there's only one (or zero) paired boxes, so it's
 * a no-op visually for the common single-box case. */
export function DeviceSwitcher({
  pairings,
  selectedDeviceId,
  onChange,
}: {
  pairings: PairingData[];
  selectedDeviceId: string | null;
  onChange: (deviceId: string) => void;
}) {
  if (pairings.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {pairings.map((pairing, i) => (
        <button
          key={pairing.deviceId}
          onClick={() => onChange(pairing.deviceId)}
          className={cn(
            "shrink-0 h-9 px-4 rounded-full text-xs font-semibold border transition-colors",
            selectedDeviceId === pairing.deviceId
              ? "brand-gradient text-white border-transparent"
              : "bg-card text-muted-foreground border-border hover:border-muted-foreground"
          )}
        >
          Monto Box {i + 1}
        </button>
      ))}
    </div>
  );
}
