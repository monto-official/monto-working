import type { PairingData } from "./pairing-storage";

export interface Reminder {
  id: string;
  label: string;
  time: string;
  days_of_week: number[];
  active: boolean;
  created_at: string;
}

export interface Question {
  id: number;
  question: string;
  answer: string | null;
  timestamp: string | number;
}

export interface BedtimeSchedule {
  start_time: string;
  end_time: string;
  enabled: boolean;
}

export interface VoiceMessage {
  id: string;
  sender_role: "parent" | "child";
  duration_ms: number | null;
  mime_type: string;
  created_at: string;
  listened_at: string | null;
}

export interface WeeklyUsageDay {
  day: string;
  hours: number;
}

/** Shared fetch helper — extracts a readable error message from a non-ok
 * response the same way `pairing-storage.ts`'s `redeemPairingCode` does,
 * then parses and returns the JSON body. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Couldn't reach the server. Check your connection.");
  }

  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
      else if (typeof body?.message === "string") message = body.message;
    } catch {
      /* body wasn't JSON — keep the generic message */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;

  try {
    return (await res.json()) as T;
  } catch {
    return undefined as T;
  }
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function getQuestions(
  pairing: PairingData
): Promise<{ questions: Question[]; total: number }> {
  return request(`${pairing.apiUrl}/voice/questions/${pairing.deviceId}`);
}

export function listReminders(pairing: PairingData): Promise<Reminder[]> {
  return request(`${pairing.apiUrl}/reminders/${pairing.deviceId}`);
}

export function createReminder(
  pairing: PairingData,
  data: { label: string; time: string; days_of_week: number[]; active: boolean }
): Promise<Reminder> {
  return request(
    `${pairing.apiUrl}/reminders/${pairing.deviceId}`,
    jsonInit("POST", data)
  );
}

export function updateReminder(
  pairing: PairingData,
  reminderId: string,
  partial: Partial<Pick<Reminder, "label" | "time" | "days_of_week" | "active">>
): Promise<Reminder> {
  return request(
    `${pairing.apiUrl}/reminders/${pairing.deviceId}/${reminderId}`,
    jsonInit("PATCH", partial)
  );
}

export function deleteReminder(pairing: PairingData, reminderId: string): Promise<void> {
  return request(
    `${pairing.apiUrl}/reminders/${pairing.deviceId}/${reminderId}`,
    jsonInit("DELETE")
  );
}

export function getBedtime(pairing: PairingData): Promise<BedtimeSchedule> {
  return request(`${pairing.apiUrl}/bedtime/${pairing.deviceId}`);
}

export function saveBedtime(
  pairing: PairingData,
  data: BedtimeSchedule
): Promise<BedtimeSchedule> {
  return request(
    `${pairing.apiUrl}/bedtime/${pairing.deviceId}`,
    jsonInit("PUT", data)
  );
}

export function getWeeklyUsage(pairing: PairingData): Promise<WeeklyUsageDay[]> {
  return request(`${pairing.apiUrl}/usage/${pairing.deviceId}/weekly`);
}

export function listVoiceMessages(pairing: PairingData): Promise<VoiceMessage[]> {
  return request(`${pairing.apiUrl}/voice-messages/${pairing.deviceId}`);
}

export async function sendVoiceMessage(
  pairing: PairingData,
  blob: Blob,
  durationMs: number
): Promise<VoiceMessage> {
  const form = new FormData();
  const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "mp4" : "webm";
  form.append("audio", blob, `note.${ext}`);
  form.append("sender_role", "parent");
  form.append("duration_ms", String(Math.round(durationMs)));

  return request(`${pairing.apiUrl}/voice-messages/${pairing.deviceId}`, {
    method: "POST",
    body: form,
  });
}

export function voiceMessageAudioUrl(pairing: PairingData, messageId: string): string {
  return `${pairing.apiUrl}/voice-messages/${pairing.deviceId}/${messageId}/audio`;
}
