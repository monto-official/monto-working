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

export async function sendVoiceQuery(
  audioBlob: Blob
): Promise<VoiceQueryResponse> {
  const formData = new FormData();
  // Determine extension based on MIME type
  const ext = audioBlob.type.includes("ogg")
    ? "ogg"
    : audioBlob.type.includes("mp4")
      ? "mp4"
      : "webm";
  formData.append("audio", audioBlob, `recording.${ext}`);

  const res = await fetch(`${API_URL}/voice/query`, {
    method: "POST",
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
