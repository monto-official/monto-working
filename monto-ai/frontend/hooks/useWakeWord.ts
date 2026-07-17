"use client";
/**
 * useWakeWord — "Hey Monto" detection
 *
 * PRIMARY: Teachable Machine audio model (loaded from CDN at runtime)
 *   Model: https://teachablemachine.withgoogle.com/models/oej33d7Yu/
 *   Classes: Background Noise | Hey Monto | Random Words
 *
 * FALLBACK: Web Speech API (if TM model fails to load)
 */
import { useEffect, useRef, useCallback, useState } from "react";

interface UseWakeWordOptions {
  onDetected: () => void;
  enabled: boolean;
  keywords?: string[];
  language?: string;
}

const TM_MODEL_URL = "https://teachablemachine.withgoogle.com/models/oej33d7Yu/";
const WAKE_LABEL   = "Hey Monto";
const THRESHOLD    = 0.82;
const COOLDOWN_MS  = 3000;
const RESTART_MS   = 300;
const ERR_RETRY_MS = 1000;

// ── Load CDN scripts ──────────────────────────────────────────────────────────
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function loadTMLibs() {
  await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
  await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js");
}

// ── Teachable Machine wake word ───────────────────────────────────────────────
function useTMWakeWord(options: { onDetected: () => void; enabled: boolean }) {
  const [ready, setReady]   = useState(false);
  const [active, setActive] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognizerRef = useRef<any>(null);
  const cooldownRef   = useRef(false);
  const onDetRef      = useRef(options.onDetected);
  useEffect(() => { onDetRef.current = options.onDetected; }, [options.onDetected]);

  // Load CDN libs + model once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      try {
        await loadTMLibs();
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const speechCommands = (window as any).speechCommands;
        if (!speechCommands) throw new Error("speechCommands not found on window");

        const recognizer = speechCommands.create(
          "BROWSER_FFT",
          undefined,
          `${TM_MODEL_URL}model.json`,
          `${TM_MODEL_URL}metadata.json`,
        );
        await recognizer.ensureModelLoaded();
        if (cancelled) return;

        recognizerRef.current = recognizer;
        setReady(true);
        console.log("[TM] ✅ model loaded, labels:", recognizer.wordLabels());
      } catch (err) {
        console.warn("[TM] failed to load model, falling back to Web Speech:", err);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Start/stop based on enabled
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = recognizerRef.current as any;
    if (!ready || !rec) return;

    if (options.enabled) {
      if (rec.isListening()) return;
      rec.listen(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result: any) => {
          if (cooldownRef.current) return;
          const labels: string[] = rec.wordLabels();
          const scores: Float32Array = result.scores;
          const idx = labels.indexOf(WAKE_LABEL);
          if (idx === -1) return;
          const conf = scores[idx];
          if (conf >= THRESHOLD) {
            console.log(`[TM] ✅ "${WAKE_LABEL}" — ${(conf * 100).toFixed(1)}%`);
            cooldownRef.current = true;
            onDetRef.current();
            setTimeout(() => { cooldownRef.current = false; }, COOLDOWN_MS);
          }
        },
        {
          includeSpectrogram: false,
          probabilityThreshold: THRESHOLD - 0.1,
          invokeCallbackOnNoiseAndUnknown: true,
          overlapFactor: 0.5,
        },
      );
      setActive(true);
      console.log("[TM] 👂 listening for Hey Monto");
    } else {
      if (rec.isListening()) rec.stopListening();
      setActive(false);
    }
  }, [ready, options.enabled]);

  // Cleanup
  useEffect(() => () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = recognizerRef.current as any;
    if (rec?.isListening()) rec.stopListening();
  }, []);

  return { ready, active };
}

// ── Web Speech fallback ───────────────────────────────────────────────────────
const SPEECH_KEYWORDS = [
  "hey monto", "hi monto", "hello monto", "monto",
  "hey montu", "hi montu", "montu",
  "hey mondo", "hey mon",
  "मन्टो", "हे मन्टो",
];

function useSpeechWakeWord(options: {
  onDetected: () => void;
  enabled: boolean;
  keywords?: string[];
  language?: string;
}) {
  const [listening, setListening] = useState(false);
  const [gestureOk, setGestureOk] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef    = useRef<any>(null);
  const runningRef  = useRef(false);
  const cooldownRef = useRef(false);
  const restartRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDetRef    = useRef(options.onDetected);
  const kwRef       = useRef(options.keywords ?? SPEECH_KEYWORDS);
  const langRef     = useRef(options.language ?? "en-US");

  useEffect(() => { onDetRef.current = options.onDetected; }, [options.onDetected]);
  useEffect(() => { kwRef.current    = options.keywords ?? SPEECH_KEYWORDS; }, [options.keywords]);
  useEffect(() => { langRef.current  = options.language ?? "en-US"; }, [options.language]);

  useEffect(() => {
    if (gestureOk) return;
    const h = () => setGestureOk(true);
    window.addEventListener("click",      h, { once: true });
    window.addEventListener("touchstart", h, { once: true });
    window.addEventListener("keydown",    h, { once: true });
    return () => {
      window.removeEventListener("click",      h);
      window.removeEventListener("touchstart", h);
      window.removeEventListener("keydown",    h);
    };
  }, [gestureOk]);

  const clearRestart = useCallback(() => {
    if (restartRef.current) { clearTimeout(restartRef.current); restartRef.current = null; }
  }, []);

  const stopRecog = useCallback(() => {
    setListening(false); clearRestart();
    if (recogRef.current) {
      try { recogRef.current.abort(); } catch { /* ignore */ }
      recogRef.current = null;
    }
  }, [clearRestart]);

  const startRecog = useCallback(() => {
    if (!runningRef.current || cooldownRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    stopRecog();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR();
    r.continuous = true; r.interimResults = true;
    r.lang = langRef.current; r.maxAlternatives = 5;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      if (cooldownRef.current) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        for (let j = 0; j < e.results[i].length; j++) {
          const text = e.results[i][j].transcript.toLowerCase().trim().replace(/[.,!?]/g, "");
          if (kwRef.current.some(kw => text.includes(kw.toLowerCase()))) {
            console.log("[SpeechWake] ✅", text);
            cooldownRef.current = true; stopRecog(); onDetRef.current();
            setTimeout(() => { cooldownRef.current = false; if (runningRef.current) startRecog(); }, COOLDOWN_MS);
            return;
          }
        }
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      if (e.error === "not-allowed") { runningRef.current = false; setListening(false); return; }
      setListening(false); clearRestart();
      restartRef.current = setTimeout(() => { if (runningRef.current) startRecog(); }, ERR_RETRY_MS);
    };
    r.onend = () => {
      setListening(false);
      if (!runningRef.current || cooldownRef.current) return;
      clearRestart();
      restartRef.current = setTimeout(() => { if (runningRef.current && !cooldownRef.current) startRecog(); }, RESTART_MS);
    };
    r.onstart = () => setListening(true);
    try { r.start(); recogRef.current = r; }
    catch { restartRef.current = setTimeout(() => { if (runningRef.current) startRecog(); }, ERR_RETRY_MS); }
  }, [stopRecog, clearRestart]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (options.enabled && gestureOk) {
      runningRef.current = true; cooldownRef.current = false; startRecog();
    } else {
      runningRef.current = false; stopRecog();
    }
    return () => { runningRef.current = false; stopRecog(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled, gestureOk]);

  return { listening };
}

// ── Main export ───────────────────────────────────────────────────────────────
export function useWakeWord({ onDetected, enabled, keywords, language }: UseWakeWordOptions) {
  const tm     = useTMWakeWord({ onDetected, enabled });
  const speech = useSpeechWakeWord({
    onDetected,
    enabled: enabled && !tm.ready,   // speech fallback only while TM model is loading
    keywords,
    language,
  });

  return {
    supported: true,
    listening: tm.active || speech.listening,
  };
}
