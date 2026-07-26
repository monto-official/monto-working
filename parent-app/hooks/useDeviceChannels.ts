"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PairingData } from "@/lib/pairing-storage";
import { createFirebaseSignaling, sendFirebaseSignal, type FirebaseSignalingChannel } from "@/lib/firebase-signaling";

/** Like useDeviceChannel, but for every paired box at once: a command sent
 * here goes out to all of them (e.g. "play this song" reaches whichever
 * boxes are online), and `lastMessage` reflects whichever box most recently
 * echoed a status update — good enough for a single "now playing" UI without
 * needing a per-device player. */
export function useDeviceChannels(pairings: PairingData[]) {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const channelsRef = useRef<Record<string, FirebaseSignalingChannel>>({});

  const sendAll = useCallback((msg: object) => {
    const message = msg as Record<string, unknown>;
    const type = typeof message.type === "string" ? message.type : "control";
    const payload = { ...message };
    delete payload.type;
    for (const pairing of pairings) {
      const channel = channelsRef.current[pairing.deviceId];
      void (channel?.send(type, payload) ?? sendFirebaseSignal(`${pairing.deviceId}:control`, "parent", type, payload)).catch(() => {});
    }
  }, [pairings]);

  const deviceIds = pairings.map((p) => p.deviceId).join(",");

  useEffect(() => {
    let stopped = false;
    const channels = channelsRef.current;

    for (const pairing of pairings) {
      void createFirebaseSignaling({
        room: `${pairing.deviceId}:control`,
        role: "parent",
        onSignal: (type, payload) => setLastMessage({ type, ...payload }),
        onPeerOnline: (isOnline) => setOnlineMap((prev) => ({ ...prev, [pairing.deviceId]: isOnline })),
        onError: () => setOnlineMap((prev) => ({ ...prev, [pairing.deviceId]: false })),
      }).then((channel) => {
        if (stopped) channel.close();
        else channels[pairing.deviceId] = channel;
      }).catch(() => setOnlineMap((prev) => ({ ...prev, [pairing.deviceId]: false })));
    }

    return () => {
      stopped = true;
      for (const id of Object.keys(channels)) {
        channels[id]?.close();
        delete channels[id];
      }
      setOnlineMap({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceIds]);

  const anyOnline = Object.values(onlineMap).some(Boolean);

  return { sendAll, lastMessage, anyOnline };
}
