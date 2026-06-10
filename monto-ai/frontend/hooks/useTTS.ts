"use client";
import { useCallback, useRef, useState } from "react";
import { Settings } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [usingElevenLabs, setUsingElevenLabs] = useState(true);

  const cancelAll = useCallback(() => {
    // Stop ElevenLabs audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    // Stop browser TTS
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speakWithElevenLabs = useCallback(
    async (
      text: string,
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
            voice: settings.voice,
            language: settings.language,
          }),
        });

        if (!res.ok) return false;

        const arrayBuffer = await res.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => onStart?.();
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          onEnd?.();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          onEnd?.();
        };

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

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      utterance.lang = settings.language === "nepali" ? "ne-NP" : "en-US";
      utterance.rate = 0.9;
      utterance.pitch = settings.voice === "female" ? 1.2 : 0.9;
      utterance.volume = 1;

      const voices = window.speechSynthesis.getVoices();
      const langVoices = voices.filter((v) =>
        v.lang.startsWith(settings.language === "nepali" ? "ne" : "en")
      );
      if (langVoices[0]) utterance.voice = langVoices[0];

      utterance.onstart = () => onStart?.();
      utterance.onend = () => onEnd?.();
      utterance.onerror = () => onEnd?.();
      window.speechSynthesis.speak(utterance);
    },
    []
  );

  const speak = useCallback(
    async (
      text: string,
      settings: Settings,
      onStart?: () => void,
      onEnd?: () => void
    ) => {
      cancelAll();
      if (!text.trim()) { onEnd?.(); return; }

      // Try ElevenLabs first
      if (usingElevenLabs) {
        const success = await speakWithElevenLabs(text, settings, onStart, onEnd);
        if (success) return;
        // ElevenLabs failed — fall back to browser for this session
        setUsingElevenLabs(false);
      }

      // Browser fallback
      speakWithBrowser(text, settings, onStart, onEnd);
    },
    [usingElevenLabs, cancelAll, speakWithElevenLabs, speakWithBrowser]
  );

  const cancel = useCallback(() => {
    cancelAll();
  }, [cancelAll]);

  return { speak, cancel, usingElevenLabs };
}
