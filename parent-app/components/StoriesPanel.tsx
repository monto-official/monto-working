"use client";
/**
 * StoriesPanel — lets a parent browse bedtime stories and play them on the
 * child's Monto box, mirroring MusicScreen.tsx. Playback happens on the
 * child device (real story mp3s under frontend/public/stories) — this
 * screen only sends remote-control commands and reflects the child's
 * real status echoes back.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Pause, Square, BookOpen } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { loadPairings, type PairingData } from "@/lib/pairing-storage";
import { useDeviceChannels } from "@/hooks/useDeviceChannels";
import { STORIES } from "@/lib/stories";

const LANG_LABEL: Record<string, string> = { ne: "Nepali", hi: "Hindi", en: "English" };

export function StoriesPanel() {
  // undefined = pairings not checked yet
  const [pairings, setPairings] = useState<PairingData[] | undefined>(undefined);

  useEffect(() => {
    setPairings(loadPairings());
  }, []);

  const { sendAll: send, lastMessage, anyOnline: online } = useDeviceChannels(pairings ?? []);
  const paired = Boolean(pairings && pairings.length > 0);

  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Drive all "now playing" UI from the child's real story-status echoes
  // instead of local-only optimistic state.
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "story-status") return;
    setPlaying(Boolean(lastMessage.playing));
    if (typeof lastMessage.trackId === "string") setActiveStoryId(lastMessage.trackId);
    if (typeof lastMessage.currentTime === "number") setCurrentTime(lastMessage.currentTime);
    if (typeof lastMessage.duration === "number") setDuration(lastMessage.duration);
  }, [lastMessage]);

  const story = STORIES.find((s) => s.id === activeStoryId) ?? null;
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const playStory = (id: string) => {
    send({ type: "story-command", action: "play", trackId: id });
  };

  const togglePlayPause = () => {
    send({ type: "story-command", action: playing ? "pause" : "play", trackId: activeStoryId ?? undefined });
  };

  const stop = () => {
    send({ type: "story-command", action: "stop" });
  };

  return (
    <PhoneShell>
      <PageHeader title="Bedtime Stories" />
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-44">
        <p className="text-sm text-muted-foreground -mt-1 mb-3">Choose a story to play on the AI Box.</p>

        {pairings !== undefined && !paired && (
          <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground mb-3">
            Pair with your child's Monto box from the{" "}
            <Link href="/call" className="text-primary font-semibold">Call screen</Link> to control stories.
          </div>
        )}
        {paired && !online && (
          <div className="rounded-2xl bg-warning/15 text-warning-foreground p-3 text-xs font-semibold mb-3 text-center">
            No paired box is online — commands won't reach the AI Box right now.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {STORIES.map((s) => (
            <button
              key={s.id}
              onClick={() => playStory(s.id)}
              className={`text-left rounded-3xl overflow-hidden border bg-card shadow-card hover:shadow-elevated transition ${
                activeStoryId === s.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <div className="aspect-square brand-gradient flex items-center justify-center text-4xl overflow-hidden">
                {s.thumbnail
                  ? <img src={`/stories/thumbs/${s.thumbnail}`} alt="" className="w-full h-full object-cover" />
                  : s.emoji}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold leading-tight truncate">{s.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{LANG_LABEL[s.lang]}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Player */}
      <div className="absolute bottom-[68px] left-0 right-0 px-3">
        <div className="rounded-3xl bg-card border shadow-elevated p-3 flex items-center gap-3">
          <div className="size-12 rounded-xl brand-gradient flex items-center justify-center shrink-0 text-xl overflow-hidden">
            {story
              ? story.thumbnail
                ? <img src={`/stories/thumbs/${story.thumbnail}`} alt="" className="w-full h-full object-cover" />
                : story.emoji
              : <BookOpen className="size-5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{story ? story.title : "No story selected"}</p>
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
            disabled={!story}
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
