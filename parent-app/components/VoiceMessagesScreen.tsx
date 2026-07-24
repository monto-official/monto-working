"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Pause, Voicemail } from "lucide-react";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { loadPairing, type PairingData } from "@/lib/pairing-storage";
import { sendFirebaseSignal } from "@/lib/firebase-signaling";
import {
  listVoiceMessages,
  sendVoiceMessage,
  voiceMessageAudioUrl,
  type VoiceMessage,
} from "@/lib/api-client";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function VoiceMessagesScreen() {
  const [pairing, setPairing] = useState<PairingData | null | undefined>(undefined);
  const [list, setList] = useState<VoiceMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const recorder = useAudioRecorder();
  const startedAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    setPairing(loadPairing());
  }, []);

  useEffect(() => {
    if (!pairing) return;
    let active = true;
    setLoading(true);
    listVoiceMessages(pairing)
      .then((data) => {
        if (active) setList(data);
      })
      .catch((err) => {
        if (active) toast.error(err instanceof Error ? err.message : "Couldn't load voice messages");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pairing]);

  useEffect(() => {
    if (recorder.error) toast.error(recorder.error);
  }, [recorder.error]);

  useEffect(() => {
    if (!pairing) return;
    const refresh = () => {
      void listVoiceMessages(pairing).then(setList).catch(() => {});
    };
    const timer = window.setInterval(refresh, 10000);
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pairing]);

  useEffect(() => () => {
    audioRef.current?.pause();
    recorder.cancelRecording();
  }, [recorder.cancelRecording]);

  const handleRecordTap = async () => {
    if (busyRef.current) return;
    if (!pairing) {
      toast.error("Pair with your child's Monto box first.");
      return;
    }
    busyRef.current = true;
    try {
    if (recorder.recordingState === "recording") {
      const blob = await recorder.stopRecording();
      if (!blob || blob.size < 800) return;
      setSending(true);
      try {
        const created = await sendVoiceMessage(pairing, blob, Math.min(30000, performance.now() - startedAtRef.current));
        setList((l) => [created, ...l]);
        void sendFirebaseSignal(`${pairing.deviceId}:control`, "parent", "voice-message", {
          id: created.id, senderRole: "parent",
        }).catch(() => {});
        toast.success("Voice message sent!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't send voice message");
      } finally {
        setSending(false);
      }
    } else {
      startedAtRef.current = performance.now();
      await recorder.startRecording();
    }
    } finally {
      busyRef.current = false;
    }
  };

  const play = (messageId: string) => {
    if (!pairing) return;
    if (playingId === messageId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(voiceMessageAudioUrl(pairing, messageId));
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => { setPlayingId(null); toast.error("Couldn't play voice message"); };
    setPlayingId(messageId);
    void audio.play().catch(() => setPlayingId(null));
  };

  const isRec = recorder.recordingState === "recording";

  return (
    <PhoneShell>
      <PageHeader title="Voice Messages" />

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        <div className="rounded-3xl soft-gradient p-5 border flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold text-primary uppercase">Send a voice note</p>
          <Button
            onClick={handleRecordTap}
            disabled={sending}
            className={`size-16 rounded-full flex items-center justify-center ${isRec ? "bg-rose-500 hover:bg-rose-600" : "brand-gradient"}`}
          >
            {isRec ? <Square className="size-6 text-white" /> : <Mic className="size-6 text-white" />}
          </Button>
          <p className="text-xs text-muted-foreground">
            {sending ? "Sending..." : isRec ? "Tap to send" : "Tap to record"}
          </p>
        </div>

        {pairing === null && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Pair with your child's Monto box to send and receive voice messages.
          </p>
        )}
        {pairing && loading && (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        )}
        {pairing && !loading && list.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No voice messages yet.</p>
        )}

        {list.map((m) => (
          <div key={m.id} className="rounded-3xl bg-card border p-4 shadow-card flex items-center gap-3">
            <div className={`size-12 rounded-2xl flex items-center justify-center ${m.sender_role === "child" ? "brand-gradient text-white" : "bg-muted text-muted-foreground"}`}>
              <Voicemail className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{m.sender_role === "child" ? "From your child" : "You sent"}</p>
              <p className="text-xs text-muted-foreground">{formatTime(m.created_at)}</p>
            </div>
            <button
              onClick={() => play(m.id)}
              className="size-10 rounded-full brand-gradient text-white flex items-center justify-center"
            >
              {playingId === m.id ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
          </div>
        ))}
      </div>
      <BottomNav />
    </PhoneShell>
  );
}
