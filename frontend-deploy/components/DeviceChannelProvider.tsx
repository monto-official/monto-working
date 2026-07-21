"use client";

import { createContext, useContext, useState } from "react";
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

  return (
    <DeviceChannelContext.Provider value={{ lastMessage, send }}>
      {children}
    </DeviceChannelContext.Provider>
  );
}

export function useDeviceChannelContext() {
  return useContext(DeviceChannelContext);
}
