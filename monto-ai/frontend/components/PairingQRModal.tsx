"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { getOrCreateDeviceId } from "@/lib/device-id";

interface PairingQRModalProps {
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function PairingQRModal({ onClose }: PairingQRModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Ask the backend (Supabase-backed) for a short-lived pairing code so the
    // QR carries a redeemable code instead of raw TURN credentials — the
    // pairing is then recorded server-side, not just in each app's storage.
    fetch(`${API_URL}/pairing/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        child_device_id: getOrCreateDeviceId(),
        api_url: API_URL,
        turn_url: process.env.NEXT_PUBLIC_TURN_URL || undefined,
        turn_username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
        turn_password: process.env.NEXT_PUBLIC_TURN_PASSWORD || undefined,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(({ code }) => {
        if (cancelled) return;
        const payload = JSON.stringify({ v: 2, code, api: API_URL });
        return QRCode.toDataURL(payload, { width: 280, margin: 2 }).then((url) => {
          if (!cancelled) setDataUrl(url);
        });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-xs rounded-3xl bg-white p-6 text-center"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-black font-bold text-lg">Pair with Parent App</h2>
        <p className="text-black/50 text-xs mt-1 mb-4 leading-relaxed">
          Open the Monto Parent app on your phone and scan this code. You only need
          to do this once — calls will then come straight to that phone,
          from any network.
        </p>

        {error ? (
          <div className="w-[220px] h-[220px] mx-auto rounded-xl bg-red-50 flex items-center justify-center px-4">
            <p className="text-red-500 text-xs">
              Couldn't reach the server to create a pairing code. Check your connection and try again.
            </p>
          </div>
        ) : dataUrl ? (
          <img
            src={dataUrl}
            alt="Pairing QR code"
            width={220}
            height={220}
            className="mx-auto rounded-xl"
          />
        ) : (
          <div className="w-[220px] h-[220px] mx-auto rounded-xl bg-black/5 animate-pulse" />
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full h-11 rounded-2xl bg-black text-white font-semibold"
        >
          Done
        </button>
      </motion.div>

      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-6 right-6 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
      >
        <X className="w-4 h-4 text-white" />
      </button>
    </motion.div>
  );
}
