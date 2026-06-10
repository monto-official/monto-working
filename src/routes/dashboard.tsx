import { createFileRoute, Link } from "@tanstack/react-router";
import { Battery, Clock, MapPin, Search, ChevronRight, Activity, MessageCircleQuestion, Bell, Phone, Music, Mic, TrendingUp } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { MontoLogo } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Monto Parent" }] }),
  component: Dashboard,
});

const usage = [
  { day: "Mon", hours: 1.8 },
  { day: "Tue", hours: 2.4 },
  { day: "Wed", hours: 1.2 },
  { day: "Thu", hours: 2.9 },
  { day: "Fri", hours: 3.4 },
  { day: "Sat", hours: 2.1 },
  { day: "Sun", hours: 1.5 },
];

const questions = [
  { q: "Why is the sky blue?", date: "Today", time: "4:15 PM" },
  { q: "How do airplanes stay in the air?", date: "Today", time: "2:02 PM" },
  { q: "Who invented the computer?", date: "Yesterday", time: "6:30 PM" },
  { q: "What is the largest planet?", date: "Yesterday", time: "5:11 PM" },
];

const actions = [
  { to: "/dashboard", label: "Usage", icon: Activity, color: "text-primary", bg: "bg-primary/10" },
  { to: "/dashboard", label: "Questions", icon: MessageCircleQuestion, color: "text-secondary", bg: "bg-secondary/10" },
  { to: "/reminders", label: "Reminders", icon: Bell, color: "text-warning", bg: "bg-warning/15" },
  { to: "/call", label: "Call", icon: Phone, color: "text-success", bg: "bg-success/15" },
  { to: "/music", label: "Music", icon: Music, color: "text-secondary", bg: "bg-secondary/10" },
  { to: "/recordings", label: "Recordings", icon: Mic, color: "text-destructive", bg: "bg-destructive/10" },
] as const;

function Dashboard() {
  const total = usage.reduce((s, d) => s + d.hours, 0);
  const avg = total / usage.length;

  return (
    <PhoneShell>
      <header className="px-5 pt-5 pb-3 flex items-center justify-between bg-background sticky top-0 z-20">
        <MontoLogo />
        <Link to="/profile" className="size-10 rounded-full brand-gradient text-white flex items-center justify-center font-semibold shadow-card">
          AS
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
        {/* Child status card */}
        <div className="rounded-3xl brand-gradient text-white p-5 shadow-elevated relative overflow-hidden">
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center gap-3 relative">
            <div className="size-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">👦</div>
            <div className="flex-1">
              <p className="text-xs opacity-80">Active now</p>
              <h2 className="text-lg font-bold leading-tight">Aarav Sharma</h2>
              <p className="text-xs opacity-90">Age 8 • Grade 3</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 relative">
            <Stat icon={Battery} label="Battery" value="82%" />
            <Stat icon={Clock} label="Time" value="4:42 PM" />
            <Stat icon={MapPin} label="Home" value="Living Rm" />
          </div>
        </div>

        {/* Usage analytics */}
        <Card>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-bold">AI Box Usage</h3>
              <p className="text-xs text-muted-foreground">This week</p>
            </div>
            <span className="text-xs font-semibold text-success flex items-center gap-1">
              <TrendingUp className="size-3" /> +12%
            </span>
          </div>
          <div className="h-40 -mx-2 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usage} barCategoryGap={10}>
                <defs>
                  <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.55 0.24 295)" />
                    <stop offset="100%" stopColor="oklch(0.55 0.21 263)" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "oklch(0.5 0.03 260)" }} />
                <Tooltip cursor={{ fill: "oklch(0.55 0.21 263 / 0.08)" }} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.1)", fontSize: 12 }} />
                <Bar dataKey="hours" fill="url(#barFill)" radius={[8, 8, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Mini label="Weekly total" value={`${total.toFixed(1)} h`} />
            <Mini label="Daily avg" value={`${avg.toFixed(1)} h`} />
          </div>
        </Card>

        {/* Questions */}
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Questions Asked</h3>
            <button className="text-xs text-primary font-semibold">View all</button>
          </div>
          <div className="relative mt-3">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input placeholder="Search questions…" className="pl-9 h-10 rounded-xl bg-muted border-0" />
          </div>
          <ul className="mt-3 space-y-2">
            {questions.map((q) => (
              <li key={q.q} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/50 hover:bg-muted transition">
                <div className="size-9 rounded-xl bg-card flex items-center justify-center shrink-0 shadow-card">
                  <MessageCircleQuestion className="size-4 text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{q.q}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{q.date} • {q.time}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground mt-2" />
              </li>
            ))}
          </ul>
        </Card>

        {/* Quick actions */}
        <div>
          <h3 className="font-bold mb-3 px-1">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            {actions.map(({ to, label, icon: Icon, color, bg }) => (
              <Link key={label} to={to} className="rounded-2xl bg-card border p-3 shadow-card flex flex-col items-center gap-2 hover:shadow-elevated transition">
                <div className={`size-10 rounded-xl ${bg} ${color} flex items-center justify-center`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-xs font-semibold">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </PhoneShell>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl bg-card border p-5 shadow-card">{children}</div>;
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 backdrop-blur p-2.5">
      <Icon className="size-4 opacity-90" />
      <p className="text-[10px] opacity-80 mt-1">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
