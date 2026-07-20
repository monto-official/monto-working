"use client";
import { useEffect, useRef } from "react";
import { getApiUrl } from "@/lib/api-url";

export interface Reminder {
  id: string;
  label: string;
  time: string;            // "HH:MM", 24h local time
  days_of_week: number[];  // 0-6, 0=Sunday (matches JS Date.getDay())
  active: boolean;
}

const API_URL = getApiUrl();

/**
 * Polls GET /reminders/{deviceId} every 60s and invokes `onDue` for any
 * reminder that is active and matches the current local HH:MM + day of
 * week, at most once per calendar-minute (tracked via a fired-ids ref so it
 * can still re-fire on a future day/time).
 */
export function useReminderPolling(deviceId: string, onDue: (reminder: Reminder) => void) {
  const firedRef = useRef<Set<string>>(new Set());
  const onDueRef = useRef(onDue);
  useEffect(() => { onDueRef.current = onDue; }, [onDue]);

  useEffect(() => {
    if (!deviceId) return;
    let active = true;

    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/reminders/${deviceId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const reminders: Reminder[] = Array.isArray(data) ? data : (data.reminders ?? []);

        const now = new Date();
        const currentHHMM = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        const currentDay = now.getDay(); // 0=Sunday

        for (const reminder of reminders) {
          if (!reminder.active) continue;
          if (reminder.time !== currentHHMM) continue;
          if (!Array.isArray(reminder.days_of_week) || !reminder.days_of_week.includes(currentDay)) continue;

          const fireKey = `${reminder.id}:${currentHHMM}`;
          if (firedRef.current.has(fireKey)) continue;
          firedRef.current.add(fireKey);

          if (active) onDueRef.current(reminder);
        }
      } catch {
        // ignore network errors — will retry on the next 60s tick
      }
    };

    check();
    const interval = setInterval(check, 60 * 1000);
    return () => { active = false; clearInterval(interval); };
  }, [deviceId]);
}
