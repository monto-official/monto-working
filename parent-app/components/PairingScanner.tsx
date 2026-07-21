"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X } from "lucide-react";

interface PairingScannerProps {
  onDetected: (rawPayload: string) => void;
  onClose: () => void;
}

export function PairingScanner({ onDetected, onClose }: PairingScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            onDetected(code.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => setError("Camera access denied — allow camera permission to scan."));

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-5 px-8">
        <div className="w-64 h-64 border-4 border-white/70 rounded-3xl" />
        <p className="text-white text-sm text-center leading-relaxed">
          {error || 'Point the camera at the "Pair with Parent App" QR code on your child\'s Monto screen'}
        </p>
        <button
          onClick={onClose}
          className="px-6 py-3 rounded-2xl bg-white/20 text-white font-semibold"
        >
          Cancel
        </button>
      </div>

      <button
        onClick={onClose}
        aria-label="Close scanner"
        className="absolute top-6 right-6 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
      >
        <X className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}
