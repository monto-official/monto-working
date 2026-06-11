import { VoiceQueryResponse } from "@/types";

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

// ── SESSION ID ────────────────────────────────────────────────────────────────
// Each browser gets a unique persistent session ID stored in localStorage.
// This ties web conversations to the same memory as the Pi (if SESSION_ID matches).
const SESSION_ID_KEY = "monto_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "web-ssr";
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    // Generate a stable ID for this browser — includes timestamp so it's unique
    id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export function resetSessionId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_ID_KEY);
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
      // Send session ID so backend memory is tied to this browser session
      "X-Session-Id": getSessionId(),
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
  const sessionId = getSessionId();
  try {
    await fetch(`${API_URL}/voice/memory/${sessionId}`, { method: "DELETE" });
  } catch {
    // ignore
  }
}
