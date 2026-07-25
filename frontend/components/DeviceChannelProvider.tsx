"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDeviceChannel } from "@/hooks/useDeviceChannel";
import { useTTS } from "@/hooks/useTTS";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { getApiUrl } from "@/lib/api-url";
import { pauseAllRegisteredMedia } from "@/lib/media-priority";

interface DeviceChannelContextValue {
  lastMessage: any;
  send: (msg: object) => void;
  incomingVoiceNote: boolean;
  voiceNoteBlocked: boolean;
  retryVoiceNote: () => void;
  dismissVoiceNote: () => void;
}

const DeviceChannelContext = createContext<DeviceChannelContextValue>({
  lastMessage: null,
  send: () => {},
  incomingVoiceNote: false,
  voiceNoteBlocked: false,
  retryVoiceNote: () => {},
  dismissVoiceNote: () => {},
});

export function DeviceChannelProvider({ children }: { children: React.ReactNode }) {
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const { send, lastMessage } = useDeviceChannel(deviceId);
  const pathname = usePathname();
  const router = useRouter();
  const { cancel: cancelTTS } = useTTS();
  const handledCallRef = useRef<unknown>(null);
  const handledVoiceMessageRef = useRef<unknown>(null);
  const voiceNoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [incomingVoiceNote, setIncomingVoiceNote] = useState(false);
  const [voiceNoteBlocked, setVoiceNoteBlocked] = useState(false);

  // Incoming calls must work from songs, stories, games, and every other
  // child screen. The home page owns the call overlay and auto-answer flow.
  // `lastMessage` stays set to the last "incoming-call" payload until another
  // control message arrives, so this only redirects once per distinct call —
  // otherwise it would force the child back to "/" on every navigation for
  // as long as that stale message remained the latest one.
  useEffect(() => {
    if (lastMessage?.type !== "incoming-call" || lastMessage === handledCallRef.current) return;
    handledCallRef.current = lastMessage;
    if (pathname !== "/") router.push("/");
  }, [lastMessage, pathname, router]);

  // A parent's voice message must reach the child no matter what they're
  // doing — mid-song, mid-story, mid-yoga, anywhere — so this lives at the
  // provider level (mounted once above every route) rather than only on the
  // home page. It's also the highest-priority audio in the app: stop
  // whatever Monto is saying and whatever music/story is playing first, then
  // play the parent's message immediately.
  useEffect(() => {
    if (
      lastMessage?.type !== "voice-message" ||
      lastMessage.senderRole !== "parent" ||
      typeof lastMessage.id !== "string" ||
      lastMessage === handledVoiceMessageRef.current
    ) return;
    handledVoiceMessageRef.current = lastMessage;

    const messageId = lastMessage.id;
    setIncomingVoiceNote(true);
    setVoiceNoteBlocked(false);
    setTimeout(() => setIncomingVoiceNote(false), 8000);

    cancelTTS();
    pauseAllRegisteredMedia();

    // Point the <audio> straight at the endpoint instead of awaiting a full
    // fetch().blob() first — the browser starts decoding/playing as bytes
    // arrive, so it plays as soon as possible instead of after the whole
    // file downloads.
    const audio = new Audio(`${getApiUrl()}/voice-messages/${deviceId}/${messageId}/audio`);
    voiceNoteAudioRef.current = audio;
    audio.play().catch(() => {
      // Autoplay blocked (e.g. no user gesture yet since boot) — let the
      // toast's "Tap to listen" affordance retry it on a real tap instead
      // of silently failing while claiming it's playing.
      setVoiceNoteBlocked(true);
    });
  }, [lastMessage, deviceId, cancelTTS]);

  const retryVoiceNote = () => {
    voiceNoteAudioRef.current?.play().then(() => setVoiceNoteBlocked(false)).catch(() => {});
  };
  const dismissVoiceNote = () => setIncomingVoiceNote(false);

  return (
    <DeviceChannelContext.Provider value={{
      lastMessage, send, incomingVoiceNote, voiceNoteBlocked, retryVoiceNote, dismissVoiceNote,
    }}>
      {children}
    </DeviceChannelContext.Provider>
  );
}

export function useDeviceChannelContext() {
  return useContext(DeviceChannelContext);
}
