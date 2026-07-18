"use client";
/**
 * useCallCutDetector
 * ------------------
 * Uses the Teachable Machine audio model to detect "cut the call" voice command.
 * Model: https://teachablemachine.withgoogle.com/models/C_2YEddul/
 * Classes: 0=Background Noise, 1=cut the call, 2=similar of cut the call
 *
 * When confidence for class 1 or 2 exceeds threshold, onCut() is called.
 */
import { useEffect, useRef, useCallback } from "react";

const MODEL_URL    = "https://teachablemachine.withgoogle.com/models/C_2YEddul/";
const THRESHOLD    = 0.82;   // confidence threshold to trigger
const CUT_CLASSES  = [1, 2]; // class indices that mean "cut the call"

interface Options {
  enabled:   boolean;   // only run when a call is active
  onCut:     () => void;
}

export function useCallCutDetector({ enabled, onCut }: Options) {
  const recognizerRef  = useRef<any>(null);
  const listeningRef   = useRef(false);
  const onCutRef       = useRef(onCut);
  onCutRef.current     = onCut; // keep fresh ref, avoid stale closure

  const stopListening = useCallback(() => {
    if (recognizerRef.current && listeningRef.current) {
      try { recognizerRef.current.stopListening(); } catch { /* ignore */ }
      listeningRef.current = false;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (listeningRef.current) return; // already running

    try {
      // Dynamically import @tensorflow-models/speech-commands
      // This keeps the bundle size down — only loads during an active call
      const speechCommands = await import("@tensorflow-models/speech-commands");

      const recognizer = speechCommands.create(
        "BROWSER_FFT",
        undefined,
        `${MODEL_URL}model.json`,
        `${MODEL_URL}metadata.json`,
      );

      await recognizer.ensureModelLoaded();
      recognizerRef.current = recognizer;

      await recognizer.listen(
        (result: any) => {
          const scores: number[] = Array.from(result.scores);
          // Check if any "cut the call" class exceeds threshold
          const triggered = CUT_CLASSES.some(idx => (scores[idx] ?? 0) >= THRESHOLD);
          if (triggered) {
            console.log("[CallCutDetector] Cut the call detected!", scores);
            stopListening();
            onCutRef.current();
          }
        },
        {
          includeSpectrogram: false,
          probabilityThreshold: THRESHOLD,
          invokeCallbackOnNoiseAndUnknown: false,
          overlapFactor: 0.5,
        },
      );

      listeningRef.current = true;
      console.log("[CallCutDetector] Listening for 'cut the call'…");
    } catch (err) {
      console.warn("[CallCutDetector] Failed to start:", err);
    }
  }, [stopListening]);

  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }
    return () => { stopListening(); };
  }, [enabled, startListening, stopListening]);
}
