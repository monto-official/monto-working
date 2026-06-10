import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Sun, BookOpen, Brain, Moon, Droplets, Sparkles, Clock, MoreVertical } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/reminders")({
  head: () => ({ meta: [{ title: "Reminders — Monto Parent" }] }),
  component: RemindersScreen,
});

const presets = [
  { label: "Wake Up", icon: Sun },
  { label: "Homework", icon: BookOpen },
  { label: "Reading", icon: BookOpen },
  { label: "Study", icon: Brain },
  { label: "Prayer", icon: Sparkles },
  { label: "Water Break", icon: Droplets },
  { label: "Bed Time", icon: Moon },
  { label: "Custom", icon: Clock },
] as const;

const days = ["S", "M", "T", "W", "T", "F", "S"];

type Reminder = { id: string; name: string; time: string; days: string; active: boolean; icon: typeof Sun };

const initial: Reminder[] = [
  { id: "1", name: "Wake Up", time: "07:00 AM", days: "Mon–Fri", active: true, icon: Sun },
  { id: "2", name: "Homework Time", time: "04:30 PM", days: "Mon–Fri", active: true, icon: BookOpen },
  { id: "3", name: "Reading Time", time: "07:00 PM", days: "Daily", active: false, icon: BookOpen },
  { id: "4", name: "Bed Time", time: "09:30 PM", days: "Daily", active: true, icon: Moon },
];

function RemindersScreen() {
  const [list, setList] = useState<Reminder[]>(initial);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<typeof presets[number]["label"]>("Wake Up");
  const [name, setName] = useState("");
  const [time, setTime] = useState("07:00");
  const [picked, setPicked] = useState<number[]>([1, 2, 3, 4, 5]);

  const togglePick = (i: number) => setPicked(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i]);

  const save = () => {
    setList(l => [{
      id: String(Date.now()), name: name || selected, time, days: picked.length === 7 ? "Daily" : "Custom", active: true,
      icon: presets.find(p => p.label === selected)?.icon ?? Clock,
    }, ...l]);
    toast.success("Reminder saved");
    setOpen(false);
    setName("");
  };

  return (
    <PhoneShell>
      <PageHeader title="Reminders" right={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="size-9 rounded-full brand-gradient text-white flex items-center justify-center shadow-card">
              <Plus className="size-5" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[400px] rounded-3xl">
            <DialogHeader><DialogTitle>New Reminder</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Category</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {presets.map(({ label, icon: Icon }) => (
                    <button key={label} onClick={() => { setSelected(label); setName(label); }}
                      className={`p-2 rounded-2xl border flex flex-col items-center gap-1 ${selected === label ? "border-primary bg-primary/10" : "border-border"}`}>
                      <Icon className={`size-4 ${selected === label ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-[10px] font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reminder name" className="h-11 rounded-xl mt-1.5" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Time</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11 rounded-xl mt-1.5" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Repeat</Label>
                <div className="flex gap-1.5 mt-2">
                  {days.map((d, i) => (
                    <button key={i} onClick={() => togglePick(i)}
                      className={`size-9 rounded-full text-xs font-semibold ${picked.includes(i) ? "brand-gradient text-white" : "bg-muted text-muted-foreground"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={save} className="w-full h-11 rounded-2xl brand-gradient text-white">Save Reminder</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        <div className="rounded-3xl soft-gradient p-5 border">
          <p className="text-xs font-semibold text-primary uppercase">Today</p>
          <h2 className="text-xl font-bold mt-1">{list.filter(r => r.active).length} active reminders</h2>
          <p className="text-xs text-muted-foreground mt-1">Keeping your child on track all day.</p>
        </div>

        {list.map((r) => (
          <div key={r.id} className="rounded-3xl bg-card border p-4 shadow-card flex items-center gap-3">
            <div className={`size-12 rounded-2xl flex items-center justify-center ${r.active ? "brand-gradient text-white" : "bg-muted text-muted-foreground"}`}>
              <r.icon className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.time} • {r.days}</p>
            </div>
            <Switch checked={r.active} onCheckedChange={(v) => setList(l => l.map(x => x.id === r.id ? { ...x, active: v } : x))} />
            <button className="size-8 rounded-full hover:bg-muted flex items-center justify-center">
              <MoreVertical className="size-4 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>
      <BottomNav />
    </PhoneShell>
  );
}
