"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDeviceChannel } from "@/hooks/useDeviceChannel";
import { getOrCreateDeviceId } from "@/lib/device-id";

interface DeviceChannelContextValue {
  lastMessage: any;
  send: (msg: object) => void;
}

const DeviceChannelContext = createContext<DeviceChannelContextValue>({
  lastMessage: null,
  send: () => {},
});

export function DeviceChannelProvider({ children }: { children: React.ReactNode }) {
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const { send, lastMessage } = useDeviceChannel(deviceId);
  const pathname = usePathname();
  const router = useRouter();

  // Incoming calls must work from songs, stories, games, and every other
  // child screen. The home page owns the call overlay and auto-answer flow.
  useEffect(() => {
    if (lastMessage?.type === "incoming-call" && pathname !== "/") {
      router.push("/");
    }
  }, [lastMessage, pathname, router]);

  return (
    <DeviceChannelContext.Provider value={{ lastMessage, send }}>
      {children}
    </DeviceChannelContext.Provider>
  );
}

export function useDeviceChannelContext() {
  return useContext(DeviceChannelContext);
}
