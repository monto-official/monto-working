"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DeviceSwitcher } from "@/components/DeviceSwitcher";
import { useSelectedPairing } from "@/hooks/useSelectedPairing";
import { getBedtime, saveBedtime } from "@/lib/api-client";

export function BedtimeScreen() {
  const { pairings, selected: pairing, selectedDeviceId, setSelectedDeviceId } = useSelectedPairing();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startTime, setStartTime] = useState("21:00");
  const [endTime, setEndTime] = useState("07:00");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!pairing) return;
    let active = true;
    setLoading(true);
    getBedtime(pairing)
      .then((data) => {
        if (!active) return;
        setStartTime(data.start_time);
        setEndTime(data.end_time);
        setEnabled(data.enabled);
      })
      .catch((err) => {
        if (active) toast.error(err instanceof Error ? err.message : "Couldn't load bedtime schedule");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pairing]);

  const save = async () => {
    if (!pairing) {
      toast.error("Pair with your child's Monto box first.");
      return;
    }
    setSaving(true);
    try {
      await saveBedtime(pairing, { start_time: startTime, end_time: endTime, enabled });
      toast.success("Bedtime schedule saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save bedtime schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PhoneShell>
      <PageHeader title="Bedtime" />

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {pairings && pairings.length > 1 && (
          <DeviceSwitcher pairings={pairings} selectedDeviceId={selectedDeviceId} onChange={setSelectedDeviceId} />
        )}

        <div className="rounded-3xl soft-gradient p-5 border">
          <p className="text-xs font-semibold text-primary uppercase">Schedule</p>
          <h2 className="text-xl font-bold mt-1">{enabled ? "Bedtime is on" : "Bedtime is off"}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            This only stores the schedule — the AI Box doesn't lock itself yet.
          </p>
        </div>

        {pairings && pairings.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Pair with your child's Monto box to set a bedtime.</p>
            <Link href="/call" className="text-xs text-primary font-semibold mt-2 inline-block">Pair now</Link>
          </div>
        ) : (
          <div className="rounded-3xl bg-card border p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Enabled</Label>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11 rounded-xl mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">End Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-11 rounded-xl mt-1.5"
              />
            </div>
            <Button onClick={save} disabled={saving || loading} className="w-full h-11 rounded-2xl">
              {saving ? "Saving..." : "Save Schedule"}
            </Button>
          </div>
        )}
      </div>

      <BottomNav />
    </PhoneShell>
  );
}
