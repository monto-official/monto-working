const API = "/api/backend";

export interface HealthResponse {
  status: string;
  mode?: string;
  stt?: string;
  tts?: string;
  llm?: string;
  [key: string]: unknown;
}
export interface SessionSummary {
  session_id: string;
  total_messages: number;
  first_message: number | null;
  last_message: number | null;
  facts: { name?: string; age?: number; grade?: string; interests?: string[]; last_topic?: string; };
}
export interface SessionsResponse { sessions: string[]; total: number; }
export interface Message { role: "user" | "assistant"; content: string; }
export interface SessionDetail extends SessionSummary { history?: Message[]; }
export interface ClearResponse { status: string; session_id: string; }
export interface SettingsData {
  GROQ_API_KEY?: string; GROQ_LLM_MODEL?: string; WHISPER_LANGUAGE?: string;
  ELEVENLABS_API_KEY?: string; USE_LOCAL_GPU?: string; GPU_WHISPER_URL?: string;
  GPU_OLLAMA_URL?: string; GPU_PIPER_URL?: string; LOCAL_LLM_MODEL?: string;
  PIPER_DEFAULT_VOICE?: string; ALLOWED_ORIGINS?: string; MEMORY_DB_PATH?: string;
  SERVER_IP?: string; TZ?: string;
}
export interface SettingsResponse { settings: SettingsData; editable_keys: string[]; env_path: string; }
export interface SaveSettingsResponse { status: string; updated_keys: string[]; note: string; }

export const getHealth = (): Promise<HealthResponse> =>
  fetch(`${API}/health`, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export const getSessions = (): Promise<SessionsResponse> =>
  fetch(`${API}/voice/memory`, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export const getSession = (id: string): Promise<SessionDetail> =>
  fetch(`${API}/voice/memory/${encodeURIComponent(id)}`, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export const clearSession = (id: string): Promise<ClearResponse> =>
  fetch(`${API}/voice/memory/${encodeURIComponent(id)}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export const getSettings = (): Promise<SettingsResponse> =>
  fetch(`${API}/settings`, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export const saveSettings = (data: SettingsData): Promise<SaveSettingsResponse> =>
  fetch(`${API}/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export const pingUrl = async (url: string): Promise<boolean> => {
  try { const res = await fetch(url, { cache: "no-store" }); return res.ok; } catch { return false; }
};
