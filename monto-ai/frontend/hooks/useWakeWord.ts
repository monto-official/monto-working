"use client";
/**
 * useWakeWord — Browser-based wake word detection
 * Uses Web Speech API continuous recognition to detect "monto" or "hey monto"
 * No API key needed, works in Chrome/Edge on desktop and mobile
 */
import { useEffect, useRef, useCallback, useState } from "react";

interface UseWakeWordOptions {
  onDetected: () => void;
  enabled: boolean;
  keywords?: string[];
  language?: string;
}

export function useWakeWord({
  onDetected,
  enabled,
  keywords = ["monto", "hey monto", "hi monto", "hello monto"],
  language = "en-US",
}: UseWakeWordOptions) {
  // Web Speech API types are vendor-prefixed — use any for compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const runningRef     = useRef(false);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  const stop = useCallback(() => {
    runningRef.current = false;
    setListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionImpl = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SpeechRecognitionImpl();
    r.continuous      = true;
    r.interimResults  = true;
    r.lang            = language;
    r.maxAlternatives = 3;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        for (let j = 0; j < event.results[i].length; j++) {
          const text: string = event.results[i][j].transcript.toLowerCase().trim();
          if (keywords.some((kw) => text.includes(kw))) {
            console.log(`Wake word detected: "${text}"`);
            onDetected();
            // Brief pause after detection to avoid double-trigger
            stop();
            setTimeout(() => {
              if (runningRef.current) start();
            }, 3000);
            return;
          }
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (runningRef.current) {
        setTimeout(() => { if (runningRef.current) start(); }, 1000);
      }
    };

    r.onend = () => {
      setListening(false);
      if (runningRef.current) {
        setTimeout(() => { if (runningRef.current) start(); }, 500);
      }
    };

    try {
      r.start();
      recognitionRef.current = r;
      setListening(true);
    } catch { /* ignore */ }
  }, [onDetected, keywords, language, stop]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const ok = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    setSupported(ok);
  }, []);

  useEffect(() => {
    if (!supported) return;
    if (enabled) {
      runningRef.current = true;
      start();
    } else {
      stop();
    }
    return () => stop();
  }, [enabled, supported, start, stop]);

  return { supported, listening };
}
