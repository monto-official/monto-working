"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createFirebaseSignaling, isFirebaseSignalingConfigured } from "@/lib/firebase-signaling";
import { loadPairing } from "@/lib/pairing-storage";

/** Opens the call screen when the child calls while the parent uses any page. */
export function IncomingCallRouter() {
  const pathname = usePathname();
  const router = useRouter();
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (pathname === "/call" || !isFirebaseSignalingConfigured()) {
      navigatingRef.current = false;
      return;
    }

    const pairing = loadPairing();
    if (!pairing) return;

    let stopped = false;
    let closeChannel: (() => void) | undefined;

    void createFirebaseSignaling({
      room: pairing.deviceId,
      role: "parent",
      onSignal: (type) => {
        if (type !== "ring" || stopped || navigatingRef.current) return;
        navigatingRef.current = true;
        router.push("/call");
      },
      onPeerOnline: () => {},
    }).then((channel) => {
      if (stopped) channel.close();
      else closeChannel = channel.close;
    }).catch(() => {
      // The /call page retains the HTTP fallback; this convenience listener
      // requires Firebase and must never make the rest of the app fail.
    });

    return () => {
      stopped = true;
      closeChannel?.();
    };
  }, [pathname, router]);

  return null;
}