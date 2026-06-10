import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play, Pause, Download, Trash2, Mic } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";

export const Route = createFileRoute("/recordings")({
  head: () => ({ meta: [{ title: "Recordings — Monto Parent" }] }),
  component: RecordingsScreen,
});

const initial = [
  { id: "1", name: "Morning Story Recording", date: "Today • 8:24 AM", duration: "2:14" },
  { id: "2", name: "Science Question Reply", date: "Today • 10:02 AM", duration: "0:48" },
  { id: "3", name: "Bedtime Conversation", date: "Yesterday • 9:15 PM", duration: "5:22" },
  { id: "4", name: "Math Practice Session", date: "Mar 4 • 4:30 PM", duration: "12:08" },
  { id: "5", name: "Storytime: The Lion", date: "Mar 3 • 7:45 PM", duration: "7:34" },
];

function RecordingsScreen() {
  const [list, setList] = useState(initial);
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <PhoneShell>
      <PageHeader title="Recordings" />
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-40 space-y-3">
        <div className="rounded-3xl soft-gradient p-5 border">
          <p className="text-xs font-semibold text-primary uppercase">Library</p>
          <h2 className="text-xl font-bold mt-1">{list.length} recordings saved</h2>
          <p className="text-xs text-muted-foreground mt-1">From your child's Monto AI Box.</p>
        </div>

        {list.map(r => (
          <div key={r.id} className="rounded-3xl bg-card border p-4 shadow-card flex items-center gap-3">
            <button onClick={() => setPlaying(p => p === r.id ? null : r.id)}
              className="size-12 rounded-2xl brand-gradient text-white flex items-center justify-center shadow-card shrink-0">
              {playing === r.id ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{r.name}</p>
              <p className="text-[11px] text-muted-foreground">{r.date} • {r.duration}</p>
              {playing === r.id && (
                <div className="h-1 rounded-full bg-muted mt-2 overflow-hidden">
                  <div className="h-full brand-gradient animate-pulse" style={{ width: "55%" }} />
                </div>
              )}
            </div>
            <button onClick={() => toast.success("Download started")} className="size-9 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition">
              <Download className="size-4" />
            </button>
            <button onClick={() => { setList(l => l.filter(x => x.id !== r.id)); toast.success("Recording deleted"); }} className="size-9 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {playing && (
        <div className="absolute bottom-[68px] left-0 right-0 px-3">
          <div className="rounded-3xl bg-card border shadow-elevated p-3 flex items-center gap-3">
            <div className="size-12 rounded-xl brand-gradient flex items-center justify-center">
              <Mic className="size-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{list.find(r => r.id === playing)?.name}</p>
              <p className="text-[11px] text-muted-foreground">Now playing</p>
            </div>
            <button onClick={() => setPlaying(null)} className="size-10 rounded-full brand-gradient text-white flex items-center justify-center">
              <Pause className="size-4 fill-current" />
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </PhoneShell>
  );
}
