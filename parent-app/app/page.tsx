"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Battery, Clock, MapPin, Search, ChevronRight, Activity,
  MessageCircleQuestion, Bell, Phone, Music, TrendingUp, BookOpen, User, Moon,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { PhoneShell } from "@/components/PhoneShell";
import { MontoLogo } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ChildAvatar } from "@/components/ChildAvatar";
import { Input } from "@/components/ui/input";
import { loadChildProfile, DEFAULT_CHILD } from "@/lib/profile-storage";
import { useRemoteControls } from "@/hooks/useRemoteControls";
import { loadPairings, type PairingData } from "@/lib/pairing-storage";
import { getQuestions, getWeeklyUsage, type Question, type WeeklyUsageDay } from "@/lib/api-client";
import { formatQuestionStamp } from "@/lib/utils";
import type { ChildProfile } from "@/types";

const actions = [
  { to: "/", label: "Usage", icon: Activity, color: "text-primary", bg: "bg-primary/10" },
  { to: "/questions", label: "Questions", icon: MessageCircleQuestion, color: "text-secondary", bg: "bg-secondary/10" },
  { to: "/reminders", label: "Reminders", icon: Bell, color: "text-warning", bg: "bg-warning/15" },
  { to: "/bedtime", label: "Bedtime", icon: Moon, color: "text-primary", bg: "bg-primary/10" },
  { to: "/call", label: "Call", icon: Phone, color: "text-success", bg: "bg-success/15" },
  { to: "/music", label: "Music", icon: Music, color: "text-secondary", bg: "bg-secondary/10" },
  { to: "/profile", label: "Parent Profile", icon: User, color: "text-destructive", bg: "bg-destructive/10" },
  { to: "/stories", label: "Bedtime Stories", icon: BookOpen, color: "text-primary", bg: "bg-primary/10" },
] as const;

export default function Dashboard() {
  const [child, setChild] = useState<ChildProfile>(DEFAULT_CHILD);
  const controls = useRemoteControls();

  // undefined = pairings not checked yet
  const [pairings, setPairings] = useState<PairingData[] | undefined>(undefined);

  useEffect(() => {
    setChild(loadChildProfile());
    setPairings(loadPairings());
  }, []);

  return (
    <PhoneShell>
      <header className="px-5 pt-5 pb-3 flex items-center justify-between bg-background sticky top-0 z-20">
        <MontoLogo />
        <Link
          href="/profile"
          className="size-10 rounded-full brand-gradient text-white flex items-center justify-center text-lg shadow-card overflow-hidden"
        >
          <ChildAvatar child={child} />
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
        {(controls?.admin_notice || controls?.maintenance_mode) && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-center text-xs font-semibold text-amber-800">
            {controls.admin_notice || "Monto is currently under maintenance."}
            {controls.maintenance_mode && <span className="block mt-1 uppercase tracking-wider text-[10px]">Maintenance mode</span>}
          </div>
        )}

        {pairings === undefined ? null : pairings.length === 0 ? (
          <Card>
            <NotPaired />
          </Card>
        ) : (
          pairings.map((pairing, i) => (
            <DeviceSection
              key={pairing.deviceId}
              pairing={pairing}
              child={child}
              label={pairings.length > 1 ? `Monto Box ${i + 1}` : undefined}
            />
          ))
        )}

        {/* Quick actions */}
        <div>
          <h3 className="font-bold mb-3 px-1">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            {actions.map(({ to, label, icon: Icon, color, bg }) => (
              <Link key={label} href={to}
                aria-disabled={label === "Call" && controls?.calls_enabled === false}
                onClick={event => { if (label === "Call" && controls?.calls_enabled === false) event.preventDefault(); }}
                className={`rounded-2xl bg-card border p-3 shadow-card flex flex-col items-center gap-2 hover:shadow-elevated transition ${label === "Call" && controls?.calls_enabled === false ? "opacity-40 cursor-not-allowed" : ""}`}>
                <div className={`size-10 rounded-xl ${bg} ${color} flex items-center justify-center`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-xs font-semibold text-center">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </PhoneShell>
  );
}

/** One paired box's status + usage + questions — the dashboard renders one
 * of these per entry in `pairings`, stacked in a list. */
function DeviceSection({ pairing, child, label }: { pairing: PairingData; child: ChildProfile; label?: string }) {
  const [usage, setUsage] = useState<WeeklyUsageDay[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    getWeeklyUsage(pairing)
      .then((data) => {
        if (active) setUsage(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });

    getQuestions(pairing)
      .then((data) => {
        if (active) setQuestions(data.questions);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [pairing]);

  const total = usage.reduce((s, d) => s + d.hours, 0);
  const avg = usage.length ? total / usage.length : 0;

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = q ? questions.filter((item) => item.question.toLowerCase().includes(q)) : questions;
    return matched.slice(0, 5);
  }, [questions, search]);

  return (
    <div className="space-y-5">
      {/* Child status card */}
      <div className="rounded-3xl brand-gradient text-white p-5 shadow-elevated relative overflow-hidden">
        <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center gap-3 relative">
          <div className="size-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl overflow-hidden">
            <ChildAvatar child={child} />
          </div>
          <div className="flex-1">
            <p className="text-xs opacity-80">{label ?? "Active now"}</p>
            <h2 className="text-lg font-bold leading-tight">{child.name || "Add your child's name"}</h2>
            <p className="text-xs opacity-90">{childLabelFor(child) || "Set up in Profile"}</p>
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
          {usage.length > 0 && (
            <span className="text-xs font-semibold text-success flex items-center gap-1">
              <TrendingUp className="size-3" /> +12%
            </span>
          )}
        </div>

        {usage.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {loaded ? "No usage data yet." : "Loading…"}
          </p>
        ) : (
          <>
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
          </>
        )}
      </Card>

      {/* Questions */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Questions Asked</h3>
          <Link href="/questions" className="text-xs text-primary font-semibold">View all</Link>
        </div>
        <div className="relative mt-3">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search questions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-muted border-0"
          />
        </div>

        <ul className="mt-3 space-y-2">
          {filteredQuestions.length === 0 && (
            <li className="text-sm text-muted-foreground py-4 text-center">
              {!loaded ? "Loading…" : search ? "No matching questions." : "No questions yet."}
            </li>
          )}
          {filteredQuestions.map((q) => {
            const { date, time } = formatQuestionStamp(q.timestamp);
            return (
              <li key={q.id} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/50 hover:bg-muted transition">
                <div className="size-9 rounded-xl bg-card flex items-center justify-center shrink-0 shadow-card">
                  <MessageCircleQuestion className="size-4 text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{q.question}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{date} • {time}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground mt-2" />
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function childLabelFor(child: ChildProfile): string {
  return [child.age && `Age ${child.age}`, child.grade].filter(Boolean).join(" • ");
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

function NotPaired() {
  return (
    <div className="py-6 text-center">
      <p className="text-sm text-muted-foreground">Pair with your child's Monto box to see this.</p>
      <Link href="/call" className="text-xs text-primary font-semibold mt-2 inline-block">Pair now</Link>
    </div>
  );
}
