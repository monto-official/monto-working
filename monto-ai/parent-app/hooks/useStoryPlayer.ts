"use client";
/**
 * useStoryPlayer — narrates a bedtime story in-browser via the Web Speech API
 * (SpeechSynthesis). No audio files or network calls required.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { BedtimeStory, StoryPlaybackState } from "@/types";

export interface UseStoryPlayerReturn {
  playbackState: StoryPlaybackState;
  activeStoryId: string | null;
  progress: number; // 0..1, approximate position within the current story
  play: (story: BedtimeStory) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function useStoryPlayer(): UseStoryPlayerReturn {
  const [playbackState, setPlaybackState] = useState<StoryPlaybackState>("idle");
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Detect support only after mount (SSR has no `window`)
  useEffect(() => {
    if (!speechSupported()) setPlaybackState("unsupported");
  }, []);

  useEffect(() => {
    return () => {
      if (speechSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (!speechSupported()) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setActiveStoryId(null);
    setProgress(0);
    setPlaybackState("idle");
  }, []);

  const play = useCallback((story: BedtimeStory) => {
    if (!speechSupported()) {
      setPlaybackState("unsupported");
      return;
    }
    window.speechSynthesis.cancel();

    const text = story.paragraphs.join(" ");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1.05;

    utterance.onboundary = (e) => {
      setProgress(Math.min(1, e.charIndex / text.length));
    };
    utterance.onend = () => {
      utteranceRef.current = null;
      setActiveStoryId(null);
      setProgress(0);
      setPlaybackState("idle");
    };
    utterance.onerror = () => {
      utteranceRef.current = null;
      setPlaybackState("idle");
    };

    utteranceRef.current = utterance;
    setActiveStoryId(story.id);
    setProgress(0);
    setPlaybackState("playing");
    window.speechSynthesis.speak(utterance);
  }, []);

  const pause = useCallback(() => {
    if (!speechSupported()) return;
    window.speechSynthesis.pause();
    setPlaybackState("paused");
  }, []);

  const resume = useCallback(() => {
    if (!speechSupported()) return;
    window.speechSynthesis.resume();
    setPlaybackState("playing");
  }, []);

  return { playbackState, activeStoryId, progress, play, pause, resume, stop };
}
