"use client";

import { useCallback, useEffect, useRef } from "react";

interface Options {
  enabled: boolean;
  onCut: () => void;
}

/** Listens for a clear hang-up phrase while a call is active. */
export function useCallCutDetector({ enabled, onCut }: Options) {
  const recognitionRef = useRef<any>(null);
  const onCutRef = useRef(onCut);
  onCutRef.current = onCut;

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try { recognition.stop(); } catch { /* already stopped */ }
    }
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined" || recognitionRef.current) return;

    const browserWindow = window as typeof window & {
      SpeechRecognition?: new () => any;
      webkitSpeechRecognition?: new () => any;
    };
    const SpeechRecognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as ArrayLike<any>)
        .map((result: any) => result[0]?.transcript || "")
        .join(" ")
        .toLowerCase();

      if (/\b(cut|end|stop|hang up)\s+(the\s+)?call\b|\bhang\s+up\b/.test(transcript)) {
        stopListening();
        onCutRef.current();
      }
    };
    recognition.onerror = () => stopListening();
    recognition.onend = () => { recognitionRef.current = null; };
    recognitionRef.current = recognition;

    try { recognition.start(); } catch { recognitionRef.current = null; }
  }, [stopListening]);

  useEffect(() => {
    if (enabled) startListening();
    else stopListening();
    return stopListening;
  }, [enabled, startListening, stopListening]);
}
