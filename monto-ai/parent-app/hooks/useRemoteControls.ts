"use client";
import { useEffect, useRef, useState } from "react";
import { loadPairing } from "@/lib/pairing-storage";

export type RemoteControls = {
  maintenance_mode: boolean; calls_enabled: boolean; admin_notice: string;
  sync_interval_seconds: number;
};
type Document = { revision: number; controls: RemoteControls };

export function useRemoteControls() {
  const [document, setDocument] = useState<Document | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      const api = loadPairing()?.apiUrl || process.env.NEXT_PUBLIC_MONTO_API_URL || "http://localhost:8000";
      try {
        const response = await fetch(`${api}/controls`, { cache: "no-store" });
        const next: Document = await response.json();
        if (active) setDocument(current => !current || next.revision >= current.revision ? next : current);
        if (active) timer.current = setTimeout(sync, Math.max(3, next.controls.sync_interval_seconds) * 1000);
      } catch {
        if (active) timer.current = setTimeout(sync, 10000);
      }
    };
    sync();
    return () => { active = false; if (timer.current) clearTimeout(timer.current); };
  }, []);

  return document?.controls;
}
