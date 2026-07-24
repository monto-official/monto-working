"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { createFirebaseSignaling, isFirebaseSignalingConfigured } from "@/lib/firebase-signaling";
import { loadPairing, type PairingData } from "@/lib/pairing-storage";
import { voiceMessageAudioUrl } from "@/lib/api-client";

/** Always-on listener for voice notes the child sends, so a toast with a
 * Play button shows up instantly no matter which screen the parent is on —
 * mirrors IncomingCallRouter, but on the persistent control channel rather
 * than the call-signaling room. */
export function VoiceMessageRouter() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isFirebaseSignalingConfigured()) return;
    const pairing = loadPairing();
    if (!pairing) return;

    let stopped = false;
    let closeChannel: (() => void) | undefined;

    const play = (p: PairingData, messageId: string) => {
      audioRef.current?.pause();
      const audio = new Audio(voiceMessageAudioUrl(p, messageId));
      audioRef.current = audio;
      void audio.play().catch(() => toast.error("Couldn't play voice message"));
    };

    void createFirebaseSignaling({
      room: `${pairing.deviceId}:control`,
      role: "parent",
      onSignal: (type, payload) => {
        if (type !== "voice-message" || stopped) return;
        if (payload.senderRole !== "child" || typeof payload.id !== "string") return;
        const messageId = payload.id;
        toast("💌 Voice message from your child!", {
          action: { label: "Play", onClick: () => play(pairing, messageId) },
        });
      },
      onPeerOnline: () => {},
    }).then((channel) => {
      if (stopped) channel.close();
      else closeChannel = channel.close;
    }).catch(() => {
      // Best-effort convenience listener — never break the rest of the app.
    });

    return () => {
      stopped = true;
      closeChannel?.();
    };
  }, []);

  return null;
}
