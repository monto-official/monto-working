"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Pause, Square, Music2 } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { loadPairing, type PairingData } from "@/lib/pairing-storage";
import { useDeviceChannel } from "@/hooks/useDeviceChannel";
import { SONGS } from "@/lib/songs";

const LANG_LABEL: Record<string, string> = { ne: "Nepali", hi: "Hindi", en: "English" };

export function MusicScreen() {
  // undefined = pairing not checked yet, null = checked and none saved
  const [pairing, setPairing] = useState<PairingData | null | undefined>(undefined);

  useEffect(() => {
    setPairing(loadPairing());
  }, []);

  const { send, lastMessage, online } = useDeviceChannel(pairing);

  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Drive all "now playing" UI from the child's real music-status echoes
  // instead of local-only optimistic state.
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "music-status") return;
    setPlaying(Boolean(lastMessage.playing));
    if (typeof lastMessage.trackId === "string") setActiveTrackId(lastMessage.trackId);
    if (typeof lastMessage.currentTime === "number") setCurrentTime(lastMessage.currentTime);
    if (typeof lastMessage.duration === "number") setDuration(lastMessage.duration);
  }, [lastMessage]);

  const track = SONGS.find((t) => t.id === activeTrackId) ?? null;
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const playTrack = (id: string) => {
    send({ type: "music-command", action: "play", trackId: id });
  };

  const togglePlayPause = () => {
    send({ type: "music-command", action: playing ? "pause" : "play", trackId: activeTrackId ?? undefined });
  };

  const stop = () => {
    send({ type: "music-command", action: "stop" });
  };

  return (
    <PhoneShell>
      <PageHeader title="Music Library" />
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-44">
        <p className="text-sm text-muted-foreground -mt-1 mb-3">Choose music to play on the AI Box.</p>

        {pairing === null && (
          <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground mb-3">
            Pair with your child's Monto box from the{" "}
            <Link href="/call" className="text-primary font-semibold">Call screen</Link> to control music.
          </div>
        )}
        {pairing && !online && (
          <div className="rounded-2xl bg-warning/15 text-warning-foreground p-3 text-xs font-semibold mb-3 text-center">
            Box is offline — commands won't reach the AI Box right now.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {SONGS.map((t) => (
            <button
              key={t.id}
              onClick={() => playTrack(t.id)}
              className={`text-left rounded-3xl overflow-hidden border bg-card shadow-card hover:shadow-elevated transition ${
                activeTrackId === t.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <div className="aspect-square brand-gradient flex items-center justify-center text-4xl overflow-hidden">
                {t.thumbnail
                  ? <img src={`/songs/thumbs/${t.thumbnail}`} alt="" className="w-full h-full object-cover" />
                  : t.emoji}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold leading-tight truncate">{t.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{LANG_LABEL[t.lang]}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Player */}
      <div className="absolute bottom-[68px] left-0 right-0 px-3">
        <div className="rounded-3xl bg-card border shadow-elevated p-3 flex items-center gap-3">
          <div className="size-12 rounded-xl brand-gradient flex items-center justify-center shrink-0 text-xl overflow-hidden">
            {track
              ? track.thumbnail
                ? <img src={`/songs/thumbs/${track.thumbnail}`} alt="" className="w-full h-full object-cover" />
                : track.emoji
              : <Music2 className="size-5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{track ? track.title : "No track selected"}</p>
            <div className="h-1 rounded-full bg-muted mt-1.5 overflow-hidden">
              <div
                className="h-full brand-gradient"
                style={{ width: `${progressPct}%`, transition: "width 0.4s" }}
              />
            </div>
          </div>
          <button onClick={stop} className="size-9 rounded-full bg-muted flex items-center justify-center">
            <Square className="size-4 fill-current" />
          </button>
          <button
            onClick={togglePlayPause}
            disabled={!track}
            className="size-12 rounded-full brand-gradient text-white flex items-center justify-center shadow-card active:scale-95 disabled:opacity-50"
          >
            {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current ml-0.5" />}
          </button>
        </div>
      </div>

      <BottomNav />
    </PhoneShell>
  );
}
