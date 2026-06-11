"use client";
import { useState, useRef, useCallback } from "react";
import { RecordingState } from "@/types";

export interface UseAudioRecorderReturn {
  recordingState: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
  error: string | null;
  audioLevel: number;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [error, setError]                   = useState<string | null>(null);
  const [audioLevel, setAudioLevel]         = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const animFrameRef     = useRef<number>(0);
  const resolveRef       = useRef<((blob: Blob | null) => void) | null>(null);
  const autoStopRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAnalyser = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setAudioLevel(0);
  }, []);

  const startAnalyser = useCallback((stream: MediaStream) => {
    try {
      const ctx     = new AudioContext();
      const source  = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(Math.min(avg / 80, 1)); // 80 instead of 128 = more sensitive
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // analyser is optional — don't block recording
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setRecordingState("requesting");

    try {
      // Request high-quality audio with processing enabled
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation:   true,
          noiseSuppression:   true,
          autoGainControl:    true,
          sampleRate:         16000,   // Whisper works best at 16kHz
          channelCount:       1,       // mono
        },
      });
      streamRef.current = stream;

      // Pick best MIME type — prefer webm/opus (best compression + quality)
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";

      const recorderOptions: MediaRecorderOptions = mimeType
        ? { mimeType, audioBitsPerSecond: 64000 }  // 64kbps — good quality, not too large
        : {};

      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        resolveRef.current?.(blob);
        resolveRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        stopAnalyser();
      };

      recorder.onerror = () => {
        setError("Recording error occurred");
        setRecordingState("error");
        resolveRef.current?.(null);
        resolveRef.current = null;
      };

      // Collect chunks every 250ms for better audio segment quality
      recorder.start(250);
      setRecordingState("recording");
      startAnalyser(stream);

      // Auto-stop after 30s
      autoStopRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 30000);

    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow microphone access."
          : "Could not start recording. Please check your microphone.";
      setError(msg);
      setRecordingState("error");
    }
  }, [startAnalyser, stopAnalyser]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      // Clear auto-stop timer
      if (autoStopRef.current) {
        clearTimeout(autoStopRef.current);
        autoStopRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }
      resolveRef.current = resolve;
      recorder.stop();
      setRecordingState("processing");
    });
  }, []);

  const cancelRecording = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      resolveRef.current = () => {}; // discard
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopAnalyser();
    setRecordingState("idle");
    setError(null);
  }, [stopAnalyser]);

  return {
    recordingState,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
    audioLevel,
  };
}
