"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Pause, Voicemail } from "lucide-react";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { loadPairings, type PairingData } from "@/lib/pairing-storage";
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

/** A voice message tagged with which paired box it came from/went to —
 * needed once there's more than one box, since each has its own message
 * history and its own audio URL. */
interface Entry {
  pairing: PairingData;
  message: VoiceMessage;
}

function mergeSorted(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => b.message.created_at.localeCompare(a.message.created_at));
}

export function VoiceMessagesScreen() {
  const [pairings, setPairings] = useState<PairingData[] | undefined>(undefined);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const recorder = useAudioRecorder();
  const startedAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    setPairings(loadPairings());
  }, []);

  const refresh = async (list: PairingData[]) => {
    const results = await Promise.all(
      list.map((pairing) =>
        listVoiceMessages(pairing)
          .then((messages) => messages.map((message): Entry => ({ pairing, message })))
          .catch(() => [] as Entry[])
      )
    );
    setEntries(mergeSorted(results.flat()));
  };

  useEffect(() => {
    if (!pairings || pairings.length === 0) return;
    let active = true;
    setLoading(true);
    refresh(pairings).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairings]);

  useEffect(() => {
    if (recorder.error) toast.error(recorder.error);
  }, [recorder.error]);

  useEffect(() => {
    if (!pairings || pairings.length === 0) return;
    const tick = () => { void refresh(pairings); };
    const timer = window.setInterval(tick, 10000);
    const onVisibility = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairings]);

  useEffect(() => () => {
    audioRef.current?.pause();
    recorder.cancelRecording();
  }, [recorder.cancelRecording]);

  const handleRecordTap = async () => {
    if (busyRef.current) return;
    if (!pairings || pairings.length === 0) {
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
        const durationMs = Math.min(30000, performance.now() - startedAtRef.current);
        // One recording, sent to every paired box.
        const results = await Promise.allSettled(
          pairings.map(async (pairing) => {
            const created = await sendVoiceMessage(pairing, blob, durationMs);
            void sendFirebaseSignal(`${pairing.deviceId}:control`, "parent", "voice-message", {
              id: created.id, senderRole: "parent",
            }).catch(() => {});
            return { pairing, message: created };
          })
        );
        const sent = results.filter((r): r is PromiseFulfilledResult<Entry> => r.status === "fulfilled").map((r) => r.value);
        if (sent.length > 0) {
          setEntries((prev) => mergeSorted([...sent, ...prev]));
          toast.success(
            pairings.length > 1 ? `Voice message sent to ${sent.length} of ${pairings.length} boxes!` : "Voice message sent!"
          );
        }
        if (sent.length < pairings.length) {
          toast.error(`Couldn't reach ${pairings.length - sent.length} box(es) — they'll miss this message.`);
        }
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

  const play = (entry: Entry) => {
    if (playingId === entry.message.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(voiceMessageAudioUrl(entry.pairing, entry.message.id));
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => { setPlayingId(null); toast.error("Couldn't play voice message"); };
    setPlayingId(entry.message.id);
    void audio.play().catch(() => setPlayingId(null));
  };

  const isRec = recorder.recordingState === "recording";
  const paired = Boolean(pairings && pairings.length > 0);

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
            {paired && pairings!.length > 1 && !isRec && !sending && " — goes to every paired box"}
          </p>
        </div>

        {!paired && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Pair with your child's Monto box to send and receive voice messages.
          </p>
        )}
        {paired && loading && (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        )}
        {paired && !loading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No voice messages yet.</p>
        )}

        {entries.map((entry) => (
          <div key={entry.message.id} className="rounded-3xl bg-card border p-4 shadow-card flex items-center gap-3">
            <div className={`size-12 rounded-2xl flex items-center justify-center ${entry.message.sender_role === "child" ? "brand-gradient text-white" : "bg-muted text-muted-foreground"}`}>
              <Voicemail className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{entry.message.sender_role === "child" ? "From your child" : "You sent"}</p>
              <p className="text-xs text-muted-foreground">{formatTime(entry.message.created_at)}</p>
            </div>
            <button
              onClick={() => play(entry)}
              className="size-10 rounded-full brand-gradient text-white flex items-center justify-center"
            >
              {playingId === entry.message.id ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
          </div>
        ))}
      </div>
      <BottomNav />
    </PhoneShell>
  );
}
