"use client";
import { useCallback, useRef, useState } from "react";
import { Settings } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Nepali detection ──────────────────────────────────────────────────────────
function isNepali(text: string): boolean {
  // Devanagari Unicode range: U+0900–U+097F
  return /[\u0900-\u097F]/.test(text);
}

export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [usingBackend, setUsingBackend] = useState(true);

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

  // ── Backend TTS (ElevenLabs / Piper / gTTS Nepali) ───────────────────────
  const speakWithBackend = useCallback(async (
    text: string,
    emotion: string,
    language: string,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/tts/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice:    "monto",
          emotion:  emotion || "neutral",
          language: language,   // "nepali" routes to gTTS/Edge TTS on GPU
        }),
      });

      if (!res.ok) return false;

      const contentType = res.headers.get("Content-Type") || "audio/mpeg";
      const arrayBuffer = await res.arrayBuffer();
      const blob        = new Blob([arrayBuffer], { type: contentType });
      const url         = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay  = () => onStart?.();
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd?.(); };
      audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd?.(); };
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Browser TTS fallback ──────────────────────────────────────────────────
  const speakWithBrowser = useCallback((
    text: string,
    language: string,
    onStart?: () => void,
    onEnd?: () => void
  ) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { onEnd?.(); return; }
    window.speechSynthesis.cancel();

    const utterance    = new SpeechSynthesisUtterance(text);
    const isNe         = language === "nepali" || isNepali(text);
    utterance.lang     = isNe ? "ne-NP" : "en-US";
    utterance.rate     = isNe ? 0.85 : 0.9;
    utterance.pitch    = 1.1;
    utterance.volume   = 1;

    // Try to find a matching voice
    const voices   = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith(isNe ? "ne" : "en-US"));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => onStart?.();
    utterance.onend   = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
  }, []);

  // ── Main speak function ───────────────────────────────────────────────────
  const speak = useCallback(async (
    text:      string,
    emotion:   string,
    settings:  Settings,
    onStart?:  () => void,
    onEnd?:    () => void
  ) => {
    cancelAll();
    if (!text.trim()) { onEnd?.(); return; }

    // Auto-detect language from text content
    const detectedNepali = isNepali(text);
    const language       = detectedNepali ? "nepali" : (settings.language || "english");

    if (usingBackend) {
      const ok = await speakWithBackend(text, emotion, language, onStart, onEnd);
      if (ok) return;
      // Backend failed — fall back to browser
      setUsingBackend(false);
    }

    // Browser TTS fallback
    speakWithBrowser(text, language, onStart, onEnd);
  }, [usingBackend, cancelAll, speakWithBackend, speakWithBrowser]);

  return {
    speak,
    cancel: cancelAll,
    usingElevenLabs: usingBackend,
  };
}
