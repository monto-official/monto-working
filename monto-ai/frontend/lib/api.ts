import { VoiceQueryResponse } from "@/types";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { getApiUrl } from "@/lib/api-url";

const API_URL = getApiUrl();

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

  const res = await fetch(`${API_URL}/voice/query`, {
    method: "POST",
    headers: {
      // Send the stable per-device ID (same one used for pairing/calls) so
      // backend memory is tied to this physical device, not a random
      // per-browser-tab session — this is what lets the parent app scope
      // "Questions Asked" / "Usage" to the right child device.
      "X-Session-Id": getOrCreateDeviceId(),
    },
    body: formData,
  });

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
