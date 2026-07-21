"use client";
/**
 * useTTS — Single-instance audio manager for Monto AI.
 *
 * Guarantees:
 *  - Only ONE audio instance ever plays at a time (module-level singleton).
 *  - Any in-flight fetch is aborted before starting a new one.
 *  - onEnd fires exactly once, after the 'ended' event.
 *  - No duplicate requests, no echo, no overlap.
 *  - Works for both backend TTS and browser speech synthesis fallback.
 */
import { useCallback, useRef } from "react";
import { Settings } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Module-level singleton ────────────────────────────────────────────────────
// Kept OUTSIDE React so it survives re-renders without recreating.
let _audio:       HTMLAudioElement | null = null;
let _objectUrl:   string | null = null;
let _abortCtrl:   AbortController | null = null;
let _speaking     = false;

/** Hard-stop and clean up everything — safe to call multiple times */
function _stopAll() {
  // Abort any in-flight fetch
  if (_abortCtrl) { _abortCtrl.abort(); _abortCtrl = null; }

  // Stop and destroy the Audio element
  if (_audio) {
    _audio.onplay    = null;
    _audio.onended   = null;
    _audio.onerror   = null;
    _audio.pause();
    _audio.src = "";
    _audio.load(); // force reset
    _audio = null;
  }

  // Revoke blob URL
  if (_objectUrl) { URL.revokeObjectURL(_objectUrl); _objectUrl = null; }

  // Cancel browser speech
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  _speaking = false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isNepali(text: string) { return /[\u0900-\u097F]/.test(text); }

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useTTS() {
  // Track whether the backend TTS ever failed so we can fall back
  const backendFailed = useRef(false);

  // ── Backend TTS ─────────────────────────────────────────────────────────
  const speakBackend = useCallback(async (
    text:     string,
    emotion:  string,
    language: string,
    onStart:  () => void,
    onEnd:    () => void,
  ): Promise<boolean> => {
    const ctrl = new AbortController();
    _abortCtrl  = ctrl;

    let res: Response;
    try {
      res = await fetch(`${API_URL}/tts/speak`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, voice: "monto", emotion, language }),
        signal:  ctrl.signal,
      });
    } catch (e: unknown) {
      // Aborted or network error — not a backend failure
      if (e instanceof Error && e.name === "AbortError") return true; // graceful cancel
      return false;
    }

    if (!res.ok) return false;

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await res.arrayBuffer();
    } catch {
      return false;
    }

    // Check we're still the active request (not been cancelled while fetching)
    if (_abortCtrl !== ctrl) return true;
    _abortCtrl = null;

    const contentType = res.headers.get("Content-Type") || "audio/mpeg";
    const blob        = new Blob([arrayBuffer], { type: contentType });
    const url         = URL.createObjectURL(blob);
    _objectUrl        = url;

    const audio = new Audio();
    _audio      = audio;
    _speaking   = true;

    // Wire events BEFORE setting src
    audio.onplay  = () => { onStart(); };
    audio.onended = () => {
      _stopAll();
      onEnd();
    };
    audio.onerror = () => {
      _stopAll();
      onEnd();
    };

    audio.src = url;

    try {
      await audio.play();
    } catch {
      _stopAll();
      onEnd();
    }

    return true;
  }, []);

  // ── Browser TTS fallback ─────────────────────────────────────────────────
  const speakBrowser = useCallback((
    text:     string,
    language: string,
    onStart:  () => void,
    onEnd:    () => void,
  ) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { onEnd(); return; }

    const isNe       = language === "nepali" || isNepali(text);
    const browserText = text.replace(/^\s*\[[a-zA-Z ]+\]\s*/, "");
    const utterance  = new SpeechSynthesisUtterance(browserText);
    utterance.lang   = isNe ? "ne-NP" : "en-US";
    utterance.rate   = isNe ? 0.85 : 0.92;
    utterance.pitch  = 1.05;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const voice  = voices.find(v => v.lang.startsWith(isNe ? "ne" : "en-US"));
    if (voice) utterance.voice = voice;

    utterance.onstart = () => { _speaking = true; onStart(); };
    utterance.onend   = () => { _speaking = false; onEnd(); };
    utterance.onerror = () => { _speaking = false; onEnd(); };

    window.speechSynthesis.speak(utterance);
  }, []);

  // ── Public: speak ────────────────────────────────────────────────────────
  const speak = useCallback(async (
    text:     string,
    emotion:  string,
    settings: Settings,
    onStart?: () => void,
    onEnd?:   () => void,
  ) => {
    if (!text?.trim()) { onEnd?.(); return; }

    // Hard-stop anything currently playing FIRST, synchronously
    _stopAll();

    const language = isNepali(text) ? "nepali" : (settings.language ?? "english");

    const start = onStart ?? (() => {});
    const end   = onEnd   ?? (() => {});

    if (!backendFailed.current) {
      const ok = await speakBackend(text, emotion, language, start, end);
      if (ok) return;
      // Permanent backend failure — switch to browser forever
      backendFailed.current = true;
    }

    speakBrowser(text, language, start, end);
  }, [speakBackend, speakBrowser]);

  // ── Public: cancel ───────────────────────────────────────────────────────
  const cancel = useCallback(() => { _stopAll(); }, []);

  return { speak, cancel, isSpeaking: () => _speaking };
}
