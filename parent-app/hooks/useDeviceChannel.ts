"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PairingData } from "@/lib/pairing-storage";
import { createFirebaseSignaling, sendFirebaseSignal, type FirebaseSignalingChannel } from "@/lib/firebase-signaling";

/** Persistent parent-to-child control and presence channel over Firebase. */
export function useDeviceChannel(pairing: PairingData | null | undefined) {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [online, setOnline] = useState(false);
  const channelRef = useRef<FirebaseSignalingChannel | null>(null);

  const send = useCallback((msg: object) => {
    if (!pairing) return;
    const message = msg as Record<string, unknown>;
    const type = typeof message.type === "string" ? message.type : "control";
    const payload = { ...message };
    delete payload.type;
    void (channelRef.current?.send(type, payload) ?? sendFirebaseSignal(`${pairing.deviceId}:control`, "parent", type, payload)).catch(() => {});
  }, [pairing]);

  useEffect(() => {
    if (!pairing) {
      setOnline(false);
      return;
    }
    let stopped = false;
    void createFirebaseSignaling({
      room: `${pairing.deviceId}:control`,
      role: "parent",
      onSignal: (type, payload) => setLastMessage({ type, ...payload }),
      onPeerOnline: setOnline,
      onError: () => setOnline(false),
    }).then((channel) => {
      if (stopped) channel.close();
      else channelRef.current = channel;
    }).catch(() => setOnline(false));

    return () => {
      stopped = true;
      channelRef.current?.close();
      channelRef.current = null;
      setOnline(false);
    };
  }, [pairing?.deviceId]);

  return { send, lastMessage, online: pairing ? online : false };
}