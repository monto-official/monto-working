"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { RecordingState } from "@/types";

export interface UseAudioRecorderReturn {
  recordingState: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
  error: string | null;
  audioLevel: number;
  noiseFloor: number | null;
  calibrating: boolean;
  calibrate: () => Promise<number | null>;
}

const NOISE_FLOOR_KEY = "monto:noiseFloor";
const CALIBRATION_MS = 1500;
const MIN_THRESHOLD = 0.002;
const MAX_THRESHOLD = 0.06;
// Human voice fundamentals + harmonics live roughly in this band —
// filtering outside it cuts low-pitch rumble (fans, AC hum) and
// high-pitch hiss without touching speech intelligibility.
const VOICE_HIGHPASS_HZ = 80;
const VOICE_LOWPASS_HZ = 8000;

function loadStoredNoiseFloor(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(NOISE_FLOOR_KEY);
  const val = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(val) ? val : null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [error, setError]                   = useState<string | null>(null);
  const [audioLevel, setAudioLevel]         = useState(0);
  const [noiseFloor, setNoiseFloor]         = useState<number | null>(null);
  const [calibrating, setCalibrating]       = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const gateNodeRef      = useRef<AudioWorkletNode | null>(null);
  const animFrameRef     = useRef<number>(0);
  const resolveRef       = useRef<((blob: Blob | null) => void) | null>(null);
  const completedBlobRef = useRef<Blob | null>(null);
  const autoStopRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noiseFloorRef    = useRef<number | null>(null);

  useEffect(() => {
    const stored = loadStoredNoiseFloor();
    noiseFloorRef.current = stored;
    setNoiseFloor(stored);
  }, []);

  const stopAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    setAudioLevel(0);
  }, []);

  const startAnalyser = useCallback((node: AudioNode, ctx: AudioContext) => {
    try {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      node.connect(analyser);

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

  // Listens to ambient (background) noise for a moment and learns a gate
  // threshold from it, so the noise gate knows what "quiet" sounds like
  // in this specific room.
  const calibrate = useCallback(async (): Promise<number | null> => {
    setCalibrating(true);
    setError(null);
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      const data = new Float32Array(analyser.fftSize);
      const samples: number[] = [];
      const start = ctx.currentTime;

      await new Promise<void>((resolve) => {
        const sample = () => {
          analyser.getFloatTimeDomainData(data);
          let sumSquares = 0;
          for (let i = 0; i < data.length; i++) sumSquares += data[i] * data[i];
          samples.push(Math.sqrt(sumSquares / data.length));

          if (ctx!.currentTime - start < CALIBRATION_MS / 1000) {
            requestAnimationFrame(sample);
          } else {
            resolve();
          }
        };
        sample();
      });

      const avgRms = samples.reduce((a, b) => a + b, 0) / (samples.length || 1);
      const threshold = Math.min(Math.max(avgRms * 1.55, MIN_THRESHOLD), MAX_THRESHOLD);

      noiseFloorRef.current = threshold;
      setNoiseFloor(threshold);
      window.localStorage.setItem(NOISE_FLOOR_KEY, String(threshold));
      return threshold;
    } catch {
      setError("Could not calibrate microphone. Please allow microphone access.");
      return null;
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      if (ctx) await ctx.close().catch(() => {});
      setCalibrating(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported on this device.");
      setRecordingState("error");
      return;
    }
    setError(null);
    setRecordingState("requesting");
    completedBlobRef.current = null;

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
      if (mimeType) recorderOptions.audioBitsPerSecond = 128000;

      // Build a voice-band filter + calibrated noise gate on top of the raw
      // mic stream: high/low-pass trims rumble and hiss outside the human
      // voice range, then the gate mutes anything quieter than the
      // calibrated room noise floor. Falls back to the raw stream if
      // AudioWorklet isn't available.
      let recordStream = stream;
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        await ctx.audioWorklet.addModule("/worklets/noise-gate-processor.js");

        const source   = ctx.createMediaStreamSource(stream);
        const highpass = ctx.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = VOICE_HIGHPASS_HZ;
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = VOICE_LOWPASS_HZ;

        const gate = new AudioWorkletNode(ctx, "noise-gate-processor", {
          parameterData: { threshold: noiseFloorRef.current ?? 0.008 },
        });
        gateNodeRef.current = gate;

        const destination = ctx.createMediaStreamDestination();
        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(gate);
        gate.connect(destination);

        recordStream = destination.stream;
        startAnalyser(gate, ctx);
      } catch {
        // No worklet support — record the raw (still browser-denoised) stream.
        try {
          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          startAnalyser(source, ctx);
        } catch {
          // analyser is optional
        }
      }

      const recorder = new MediaRecorder(recordStream, recorderOptions);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        setRecordingState("idle");
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        const completed = blob.size > 0 ? blob : null;
        if (resolveRef.current) resolveRef.current(completed);
        else completedBlobRef.current = completed;
        resolveRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        gateNodeRef.current?.disconnect();
        gateNodeRef.current = null;
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
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
        const completed = completedBlobRef.current;
        completedBlobRef.current = null;
        setRecordingState("idle");
        resolve(completed);
        return;
      }
      resolveRef.current = (blob) => {
        setRecordingState("idle");
        resolve(blob);
      };
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
    completedBlobRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    gateNodeRef.current?.disconnect();
    gateNodeRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
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
    noiseFloor,
    calibrating,
    calibrate,
  };
}
