import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play, Pause, Square, Music2 } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/music")({
  head: () => ({ meta: [{ title: "Music — Monto Parent" }] }),
  component: MusicScreen,
});

const tracks = [
  { name: "Happy Learning", duration: "3:42", gradient: "from-amber-400 to-pink-500" },
  { name: "Morning Motivation", duration: "4:18", gradient: "from-sky-400 to-indigo-500" },
  { name: "Bedtime Calm", duration: "6:24", gradient: "from-indigo-500 to-purple-700" },
  { name: "Nature Sounds", duration: "8:00", gradient: "from-emerald-400 to-teal-600" },
  { name: "Focus Music", duration: "5:12", gradient: "from-slate-500 to-blue-700" },
  { name: "Kids Adventure", duration: "3:55", gradient: "from-orange-400 to-red-500" },
  { name: "Classical Kids", duration: "4:36", gradient: "from-rose-300 to-fuchsia-500" },
  { name: "Relaxation", duration: "7:10", gradient: "from-cyan-400 to-blue-600" },
  { name: "Story Background", duration: "5:48", gradient: "from-violet-400 to-purple-600" },
  { name: "Instrumental Fun", duration: "4:02", gradient: "from-lime-400 to-emerald-600" },
];

function MusicScreen() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const track = tracks[active];

  return (
    <PhoneShell>
      <PageHeader title="Music Library" />
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-44">
        <p className="text-sm text-muted-foreground -mt-1 mb-4">Choose music to play on the AI Box.</p>
        <div className="grid grid-cols-2 gap-3">
          {tracks.map((t, i) => (
            <button key={t.name} onClick={() => { setActive(i); setPlaying(true); }}
              className={`text-left rounded-3xl overflow-hidden border bg-card shadow-card hover:shadow-elevated transition ${active === i ? "ring-2 ring-primary" : ""}`}>
              <div className={`aspect-square bg-gradient-to-br ${t.gradient} flex items-center justify-center`}>
                <Music2 className="size-10 text-white/80" strokeWidth={1.5} />
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold leading-tight truncate">{t.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t.duration}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Player */}
      <div className="absolute bottom-[68px] left-0 right-0 px-3">
        <div className="rounded-3xl bg-card border shadow-elevated p-3 flex items-center gap-3">
          <div className={`size-12 rounded-xl bg-gradient-to-br ${track.gradient} flex items-center justify-center shrink-0`}>
            <Music2 className="size-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{track.name}</p>
            <div className="h-1 rounded-full bg-muted mt-1.5 overflow-hidden">
              <div className="h-full brand-gradient" style={{ width: playing ? "42%" : "0%", transition: "width 0.4s" }} />
            </div>
          </div>
          <button onClick={() => setPlaying(false)} className="size-9 rounded-full bg-muted flex items-center justify-center">
            <Square className="size-4 fill-current" />
          </button>
          <button onClick={() => setPlaying(p => !p)} className="size-12 rounded-full brand-gradient text-white flex items-center justify-center shadow-card active:scale-95">
            {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current ml-0.5" />}
          </button>
        </div>
      </div>

      <BottomNav />
    </PhoneShell>
  );
}
