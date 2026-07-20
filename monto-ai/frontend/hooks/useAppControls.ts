"use client";
import { useEffect, useRef, useState } from "react";
import type { Character } from "@/types";
import { getApiUrl } from "@/lib/api-url";

export type AppControls = {
  maintenance_mode: boolean; ai_enabled: boolean; microphone_enabled: boolean;
  calls_enabled: boolean; explore_enabled: boolean; stories_enabled: boolean;
  songs_enabled: boolean; yoga_enabled: boolean; default_language: "english" | "nepali";
  default_character: Character; auto_speak: boolean; admin_notice: string;
  sync_interval_seconds: number;
};
type ControlDocument = { revision: number; updated_at: string; controls: AppControls };
const API = getApiUrl();

export function useAppControls() {
  const [document, setDocument] = useState<ControlDocument | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const response = await fetch(`${API}/controls`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const next: ControlDocument = await response.json();
        if (active) setDocument(current => !current || next.revision >= current.revision ? next : current);
        if (active) timer.current = setTimeout(sync, Math.max(3, next.controls.sync_interval_seconds) * 1000);
      } catch {
        if (active) timer.current = setTimeout(sync, 10000);
      }
    };
    sync();
    return () => { active = false; if (timer.current) clearTimeout(timer.current); };
  }, []);

  return document;
}
