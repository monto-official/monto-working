"use client";
import { useEffect, useState } from "react";
import { Plus, Sun, BookOpen, Brain, Moon, Droplets, Sparkles, Clock, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { DeviceSwitcher } from "@/components/DeviceSwitcher";
import { useSelectedPairing } from "@/hooks/useSelectedPairing";
import {
  listReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  type Reminder as ApiReminder,
} from "@/lib/api-client";

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

/** Best-effort preset icon lookup from a saved reminder's label, since the
 * backend only stores plain fields (no icon). Falls back to a generic clock. */
function iconForLabel(label: string) {
  const preset = presets.find((p) => p.label === label);
  return preset?.icon ?? Clock;
}

function daysSummary(daysOfWeek: number[]): string {
  if (daysOfWeek.length === 7) return "Daily";
  if (
    daysOfWeek.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => daysOfWeek.includes(d))
  ) {
    return "Mon–Fri";
  }
  return "Custom";
}

export function RemindersScreen() {
  const { pairings, selected: pairing, selectedDeviceId, setSelectedDeviceId } = useSelectedPairing();
  const [list, setList] = useState<ApiReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<(typeof presets)[number]["label"]>("Wake Up");
  const [name, setName] = useState("");
  const [time, setTime] = useState("07:00");
  const [picked, setPicked] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (!pairing) return;
    let active = true;
    setLoading(true);
    listReminders(pairing)
      .then((data) => {
        if (active) setList(data);
      })
      .catch((err) => {
        if (active) toast.error(err instanceof Error ? err.message : "Couldn't load reminders");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pairing]);

  const togglePick = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const save = async () => {
    if (!pairing) {
      toast.error("Pair with your child's Monto box first.");
      return;
    }
    setSaving(true);
    try {
      const created = await createReminder(pairing, {
        label: name || selectedPreset,
        time,
        days_of_week: [...picked].sort((a, b) => a - b),
        active: true,
      });
      setList((l) => [created, ...l]);
      toast.success("Reminder saved");
      setOpen(false);
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save reminder");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: ApiReminder, v: boolean) => {
    if (!pairing) return;
    setList((l) => l.map((x) => (x.id === r.id ? { ...x, active: v } : x)));
    try {
      await updateReminder(pairing, r.id, { active: v });
    } catch (err) {
      // Revert on failure.
      setList((l) => l.map((x) => (x.id === r.id ? { ...x, active: !v } : x)));
      toast.error(err instanceof Error ? err.message : "Couldn't update reminder");
    }
  };

  const remove = async (r: ApiReminder) => {
    if (!pairing) return;
    if (!window.confirm(`Delete "${r.label}"?`)) return;
    const previous = list;
    setList((l) => l.filter((x) => x.id !== r.id));
    try {
      await deleteReminder(pairing, r.id);
      toast.success("Reminder deleted");
    } catch (err) {
      setList(previous);
      toast.error(err instanceof Error ? err.message : "Couldn't delete reminder");
    }
  };

  return (
    <PhoneShell>
      <PageHeader
        title="Reminders"
        right={
          <button
            onClick={() => setOpen(true)}
            className="size-9 rounded-full brand-gradient text-white flex items-center justify-center shadow-card"
          >
            <Plus className="size-5" />
          </button>
        }
      />

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-bold mb-4">New Reminder</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Category</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {presets.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => {
                    setSelectedPreset(label);
                    setName(label);
                  }}
                  className={`p-2 rounded-2xl border flex flex-col items-center gap-1 ${
                    selectedPreset === label ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <Icon className={`size-4 ${selectedPreset === label ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Reminder name"
              className="h-11 rounded-xl mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Time</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-11 rounded-xl mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Repeat</Label>
            <div className="flex gap-1.5 mt-2">
              {days.map((d, i) => (
                <button
                  key={i}
                  onClick={() => togglePick(i)}
                  className={`size-9 rounded-full text-xs font-semibold ${
                    picked.includes(i) ? "brand-gradient text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full h-11 rounded-2xl">
            {saving ? "Saving..." : "Save Reminder"}
          </Button>
        </div>
      </Modal>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        {pairings && pairings.length > 1 && (
          <DeviceSwitcher pairings={pairings} selectedDeviceId={selectedDeviceId} onChange={setSelectedDeviceId} />
        )}

        <div className="rounded-3xl soft-gradient p-5 border">
          <p className="text-xs font-semibold text-primary uppercase">Today</p>
          <h2 className="text-xl font-bold mt-1">{list.filter((r) => r.active).length} active reminders</h2>
          <p className="text-xs text-muted-foreground mt-1">Keeping your child on track all day.</p>
        </div>

        {pairings && pairings.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Pair with your child's Monto box to manage reminders.
          </p>
        )}
        {pairing && loading && (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        )}

        {list.map((r) => {
          const Icon = iconForLabel(r.label);
          return (
            <div key={r.id} className="rounded-3xl bg-card border p-4 shadow-card flex items-center gap-3">
              <div
                className={`size-12 rounded-2xl flex items-center justify-center ${
                  r.active ? "brand-gradient text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{r.label}</p>
                <p className="text-xs text-muted-foreground">
                  {r.time} • {daysSummary(r.days_of_week)}
                </p>
              </div>
              <Switch checked={r.active} onCheckedChange={(v) => toggleActive(r, v)} />
              <button
                onClick={() => remove(r)}
                className="size-8 rounded-full hover:bg-muted flex items-center justify-center"
              >
                <MoreVertical className="size-4 text-muted-foreground" />
              </button>
            </div>
          );
        })}
      </div>
      <BottomNav />
    </PhoneShell>
  );
}
