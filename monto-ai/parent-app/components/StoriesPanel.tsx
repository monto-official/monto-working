"use client";
/**
 * StoriesPanel — lets a parent browse bedtime stories and play them aloud.
 * Narration runs entirely in-browser via the Web Speech API (see
 * hooks/useStoryPlayer.ts) — no audio files, no backend needed.
 */
import { BookOpen, Pause, Play, Square } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { STORIES } from "@/data/stories";
import { useStoryPlayer } from "@/hooks/useStoryPlayer";
import { cn } from "@/lib/utils";
import type { BedtimeStory } from "@/types";

export function StoriesPanel() {
  const { playbackState, activeStoryId, progress, play, pause, resume, stop } = useStoryPlayer();

  const activeStory = STORIES.find((s) => s.id === activeStoryId) ?? null;

  const handleCardClick = (story: BedtimeStory) => {
    if (activeStoryId === story.id && playbackState === "playing") {
      pause();
    } else if (activeStoryId === story.id && playbackState === "paused") {
      resume();
    } else {
      play(story);
    }
  };

  return (
    <PhoneShell>
      <PageHeader title="Bedtime Stories" />
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-44">
        {playbackState === "unsupported" && (
          <p className="rounded-2xl bg-warning/15 text-warning text-xs px-4 py-3 mb-4">
            This browser doesn&apos;t support read-aloud narration. Try Chrome or Edge.
          </p>
        )}

        <p className="text-sm text-muted-foreground -mt-1 mb-4">
          Tap a story to have it read aloud on the AI Box.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {STORIES.map((story) => {
            const isActive = activeStoryId === story.id;
            const isPlaying = isActive && playbackState === "playing";
            return (
              <button
                key={story.id}
                onClick={() => handleCardClick(story)}
                className={cn(
                  "text-left rounded-3xl overflow-hidden border bg-card shadow-card hover:shadow-elevated transition",
                  isActive && "ring-2 ring-primary"
                )}
              >
                <div className={`aspect-square bg-gradient-to-br ${story.gradient} flex items-center justify-center`}>
                  {isPlaying ? (
                    <Pause className="size-10 text-white/90" />
                  ) : (
                    <BookOpen className="size-10 text-white/80" strokeWidth={1.5} />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold leading-tight truncate">{story.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{story.blurb}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Player */}
      {activeStory && (
        <div className="absolute bottom-[68px] left-0 right-0 px-3">
          <div className="rounded-3xl bg-card border shadow-elevated p-3 flex items-center gap-3">
            <div className={`size-12 rounded-xl bg-gradient-to-br ${activeStory.gradient} flex items-center justify-center shrink-0`}>
              <BookOpen className="size-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{activeStory.title}</p>
              <div className="h-1 rounded-full bg-muted mt-1.5 overflow-hidden">
                <div
                  className="h-full brand-gradient"
                  style={{ width: `${Math.round(progress * 100)}%`, transition: "width 0.3s" }}
                />
              </div>
            </div>
            <button onClick={stop} className="size-9 rounded-full bg-muted flex items-center justify-center">
              <Square className="size-4 fill-current" />
            </button>
            <button
              onClick={() => (playbackState === "playing" ? pause() : resume())}
              className="size-12 rounded-full brand-gradient text-white flex items-center justify-center shadow-card active:scale-95"
            >
              {playbackState === "playing" ? (
                <Pause className="size-5 fill-current" />
              ) : (
                <Play className="size-5 fill-current ml-0.5" />
              )}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </PhoneShell>
  );
}
