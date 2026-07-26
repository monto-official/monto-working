"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createFirebaseSignaling, isFirebaseSignalingConfigured } from "@/lib/firebase-signaling";
import { loadPairings } from "@/lib/pairing-storage";
import { getActiveCallDevice, setActiveCallDevice } from "@/lib/call-state";

/** Opens the call screen when a paired child device calls while the parent
 * uses any page. Listens across every paired box at once — if one is
 * already mid-call when another rings, the first keeps priority and the
 * second just gets a toast (busy), rather than yanking the parent away. */
export function IncomingCallRouter() {
  const pathname = usePathname();
  const router = useRouter();
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (pathname === "/call" || !isFirebaseSignalingConfigured()) {
      navigatingRef.current = false;
      return;
    }

    const pairings = loadPairings();
    if (pairings.length === 0) return;

    let stopped = false;
    const closers: Array<() => void> = [];

    for (const pairing of pairings) {
      void createFirebaseSignaling({
        room: pairing.deviceId,
        role: "parent",
        onSignal: (type) => {
          if (type !== "ring" || stopped || navigatingRef.current) return;

          const busyWith = getActiveCallDevice();
          if (busyWith && busyWith !== pairing.deviceId) {
            toast.error("Another Monto box is calling too — finish this call first.");
            return;
          }

          navigatingRef.current = true;
          setActiveCallDevice(pairing.deviceId);
          router.push("/call");
        },
        onPeerOnline: () => {},
      }).then((channel) => {
        if (stopped) channel.close();
        else closers.push(channel.close);
      }).catch(() => {
        // The /call page retains the HTTP fallback; this convenience listener
        // requires Firebase and must never make the rest of the app fail.
      });
    }

    return () => {
      stopped = true;
      for (const close of closers) close();
    };
  }, [pathname, router]);

  return null;
}
