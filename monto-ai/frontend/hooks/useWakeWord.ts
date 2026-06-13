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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const runningRef     = useRef(false);
  const [supported, setSupported] = useState(false);
  const [listening, setListening]  = useState(false);

  const stop = useCallback(() => {
    runningRef.current = false;
    setListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const r = new SpeechRecognition();
    r.continuous      = true;
    r.interimResults  = true;
    r.lang            = language;
    r.maxAlternatives = 3;

    r.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        for (let j = 0; j < event.results[i].length; j++) {
          const text = event.results[i][j].transcript.toLowerCase().trim();
          if (keywords.some(kw => text.includes(kw))) {
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

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      // Restart on error
      if (runningRef.current) {
        setTimeout(() => { if (runningRef.current) start(); }, 1000);
      }
    };

    r.onend = () => {
      setListening(false);
      // Auto-restart
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
    const ok = !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
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
