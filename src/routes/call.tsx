import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, Clock } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/call")({
  head: () => ({ meta: [{ title: "Call AI Box — Monto Parent" }] }),
  component: CallScreen,
});

type Status = "idle" | "calling" | "connected" | "ended";

const history = [
  { name: "AI Box (Aarav)", date: "Today", time: "3:24 PM", duration: "4m 12s" },
  { name: "AI Box (Aarav)", date: "Yesterday", time: "8:10 PM", duration: "2m 05s" },
  { name: "AI Box (Aarav)", date: "Mar 4", time: "6:42 PM", duration: "12m 33s" },
];

function CallScreen() {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (status === "calling") {
      const t = setTimeout(() => setStatus("connected"), 2200);
      return () => clearTimeout(t);
    }
    if (status === "connected") {
      const i = setInterval(() => setSeconds(s => s + 1), 1000);
      return () => clearInterval(i);
    }
  }, [status]);

  const label = status === "idle" ? "Ready to Call" : status === "calling" ? "Calling…" : status === "connected" ? "Connected" : "Call Ended";
  const sub = status === "connected"
    ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : status === "calling" ? "Connecting to AI Box" : "Tap to start a call";

  return (
    <PhoneShell>
      <PageHeader title="Call AI Box" />
      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col">
        <div className="rounded-3xl soft-gradient p-8 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute inset-0 brand-gradient opacity-10" />
          <div className="size-24 rounded-full brand-gradient text-white flex items-center justify-center text-3xl shadow-elevated relative">
            👦
            {status === "connected" && <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-success border-2 border-white" />}
          </div>
          <h2 className="mt-4 text-xl font-bold relative">Aarav's Monto Box</h2>
          <p className="text-sm text-muted-foreground relative">{label}</p>
          <p className={`mt-1 text-sm font-mono font-semibold relative ${status === "connected" ? "text-primary" : "text-muted-foreground"}`}>{sub}</p>

          {(status === "calling") && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="size-48 rounded-full border-2 border-primary/30 animate-ping" />
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center py-8">
          {status !== "connected" ? (
            <button
              onClick={() => { setStatus("calling"); setSeconds(0); }}
              className="size-24 rounded-full brand-gradient text-white shadow-elevated flex items-center justify-center active:scale-95 transition"
            >
              <Phone className="size-8" />
            </button>
          ) : (
            <div className="flex items-center gap-5">
              <button onClick={() => setMuted(m => !m)} className={`size-14 rounded-full border-2 flex items-center justify-center ${muted ? "bg-muted" : "bg-card"}`}>
                {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </button>
              <button onClick={() => setStatus("ended")} className="size-20 rounded-full bg-destructive text-white shadow-elevated flex items-center justify-center active:scale-95">
                <PhoneOff className="size-7" />
              </button>
              <button className="size-14 rounded-full border-2 bg-card flex items-center justify-center">
                <Volume2 className="size-5" />
              </button>
            </div>
          )}
        </div>

        <div>
          <h3 className="font-bold mb-3 px-1 flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" /> Recent Calls
          </h3>
          <div className="space-y-2">
            {history.map((c, i) => (
              <div key={i} className="rounded-2xl bg-card border p-3 flex items-center gap-3 shadow-card">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Phone className="size-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.date} • {c.time}</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{c.duration}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </PhoneShell>
  );
}
