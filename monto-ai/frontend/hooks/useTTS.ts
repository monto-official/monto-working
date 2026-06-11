"use client";
import { useCallback, useRef, useState } from "react";
import { Settings } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useTTS() {
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const [usingElevenLabs, setUsingElevenLabs] = useState(true);

  const cancelAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speakWithBackend = useCallback(
    async (
      text: string,
      emotion: string,
      settings: Settings,
      onStart?: () => void,
      onEnd?: () => void
    ): Promise<boolean> => {
      try {
        const res = await fetch(`${API_URL}/tts/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voice:    settings.voice || "monto",
            emotion:  emotion || "neutral",   // ← pass emotion for voice tone
            language: settings.language || "english",
          }),
        });

        if (!res.ok) return false;

        // Detect audio format from response header (WAV local, MP3 cloud)
        const contentType = res.headers.get("Content-Type") || "audio/mpeg";
        const arrayBuffer = await res.arrayBuffer();
        const blob        = new Blob([arrayBuffer], { type: contentType });
        const url         = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay   = () => onStart?.();
        audio.onended  = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd?.(); };
        audio.onerror  = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd?.(); };

        await audio.play();
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const speakWithBrowser = useCallback(
    (
      text: string,
      settings: Settings,
      onStart?: () => void,
      onEnd?: () => void
    ) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();

      const utterance  = new SpeechSynthesisUtterance(text);
      utterance.lang   = settings.language === "nepali" ? "ne-NP" : "en-US";
      utterance.rate   = 0.9;
      utterance.pitch  = settings.voice === "female" ? 1.2 : 0.9;
      utterance.volume = 1;

      const voices     = window.speechSynthesis.getVoices();
      const langVoice  = voices.find((v) =>
        v.lang.startsWith(settings.language === "nepali" ? "ne" : "en")
      );
      if (langVoice) utterance.voice = langVoice;

      utterance.onstart = () => onStart?.();
      utterance.onend   = () => onEnd?.();
      utterance.onerror = () => onEnd?.();
      window.speechSynthesis.speak(utterance);
    },
    []
  );

  const speak = useCallback(
    async (
      text:     string,
      emotion:  string,       // ← emotion passed in
      settings: Settings,
      onStart?: () => void,
      onEnd?:   () => void
    ) => {
      cancelAll();
      if (!text.trim()) { onEnd?.(); return; }

      if (usingElevenLabs) {
        const ok = await speakWithBackend(text, emotion, settings, onStart, onEnd);
        if (ok) return;
        setUsingElevenLabs(false);
      }

      speakWithBrowser(text, settings, onStart, onEnd);
    },
    [usingElevenLabs, cancelAll, speakWithBackend, speakWithBrowser]
  );

  const cancel = useCallback(() => cancelAll(), [cancelAll]);

  return { speak, cancel, usingElevenLabs };
}
