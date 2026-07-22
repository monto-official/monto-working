import { VoiceQueryResponse } from "@/types";
import { getOrCreateDeviceId } from "@/lib/device-id";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class APIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

// ── API CALLS ─────────────────────────────────────────────────────────────────

export async function sendVoiceQuery(
  audioBlob: Blob
): Promise<VoiceQueryResponse> {
  const formData = new FormData();
  const ext = audioBlob.type.includes("ogg")
    ? "ogg"
    : audioBlob.type.includes("mp4")
      ? "mp4"
      : "webm";
  formData.append("audio", audioBlob, `recording.${ext}`);

  let res: Response | null = null;
  let networkError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      res = await fetch(`${API_URL}/voice/query`, {
        method: "POST",
        headers: { "X-Session-Id": getOrCreateDeviceId() },
        body: formData,
      });
      if (res.ok || res.status < 500) break;
    } catch (error) {
      networkError = error;
    }
    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 450));
  }
  if (!res) throw networkError instanceof Error ? networkError : new Error("Voice service unavailable");

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {
      // ignore
    }
    throw new APIError(res.status, detail);
  }

  return res.json() as Promise<VoiceQueryResponse>;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearMemory(): Promise<void> {
  const sessionId = getOrCreateDeviceId();
  try {
    await fetch(`${API_URL}/voice/memory/${sessionId}`, { method: "DELETE" });
  } catch {
    // ignore
  }
}
