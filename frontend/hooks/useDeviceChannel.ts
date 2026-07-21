"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createFirebaseSignaling, sendFirebaseSignal, type FirebaseSignalingChannel } from "@/lib/firebase-signaling";

/** Always-on Firebase control channel for the Raspberry Pi child UI. */
export function useDeviceChannel(deviceId: string) {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const channelRef = useRef<FirebaseSignalingChannel | null>(null);

  const send = useCallback((msg: object) => {
    const message = msg as Record<string, unknown>;
    const type = typeof message.type === "string" ? message.type : "control";
    const payload = { ...message };
    delete payload.type;
    void (channelRef.current?.send(type, payload) ?? sendFirebaseSignal(`${deviceId}:control`, "child", type, payload)).catch(() => {});
  }, [deviceId]);

  useEffect(() => {
    let stopped = false;
    void createFirebaseSignaling({
      room: `${deviceId}:control`,
      role: "child",
      onSignal: (type, payload) => setLastMessage({ type, ...payload }),
      onPeerOnline: () => {},
    }).then((channel) => {
      if (stopped) channel.close();
      else channelRef.current = channel;
    }).catch(() => {});

    return () => {
      stopped = true;
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [deviceId]);

  return { send, lastMessage };
}