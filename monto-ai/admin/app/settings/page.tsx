"use client";
import { useEffect, useState, useCallback } from "react";
import { getSettings, saveSettings, SettingsData } from "@/lib/api";

const GROUPS = [
  { title: "🔑 API Keys", fields: [
    { key: "GROQ_API_KEY", label: "Groq API Key", type: "password", placeholder: "gsk_...", help: "Required for STT + LLM when USE_LOCAL_GPU=false", link: { label: "Get free key →", url: "https://console.groq.com" } },
    { key: "ELEVENLABS_API_KEY", label: "ElevenLabs API Key", type: "password", placeholder: "your_key...", help: "Optional — high-quality English TTS", link: { label: "Get key →", url: "https://elevenlabs.io" } },
  ]},
  { title: "🤖 AI Mode", fields: [
    { key: "USE_LOCAL_GPU", label: "Use Local GPU", type: "select", options: ["false","true"], help: "false = Groq cloud. true = local Whisper + Ollama + Piper" },
    { key: "GROQ_LLM_MODEL", label: "Groq LLM Model", type: "select", options: ["llama-3.3-70b-versatile","llama-3.1-8b-instant","llama3-70b-8192","mixtral-8x7b-32768","gemma2-9b-it"], help: "LLM model for cloud mode" },
    { key: "WHISPER_LANGUAGE", label: "Whisper Language", type: "select", options: ["en","ne","auto"], help: "Speech recognition language hint" },
  ]},
  { title: "🖥️ GPU Server", fields: [
    { key: "GPU_WHISPER_URL", label: "Whisper STT URL", type: "text", placeholder: "http://192.168.1.100:5001", help: "Local Whisper server" },
    { key: "GPU_OLLAMA_URL", label: "Ollama LLM URL", type: "text", placeholder: "http://192.168.1.100:11434", help: "Ollama server" },
    { key: "GPU_PIPER_URL", label: "Piper TTS URL", type: "text", placeholder: "http://192.168.1.100:5002", help: "Piper TTS server" },
    { key: "LOCAL_LLM_MODEL", label: "Local LLM Model", type: "text", placeholder: "qwen3:8b", help: "Ollama model name" },
  ]},
  { title: "⚙️ General", fields: [
    { key: "SERVER_IP", label: "Server IP", type: "text", placeholder: "192.168.1.100", help: "GPU server LAN IP" },
    { key: "ALLOWED_ORIGINS", label: "CORS Origins", type: "text", placeholder: "http://localhost:3000,http://localhost:3002", help: "Comma-separated allowed origins" },
    { key: "TZ", label: "Timezone", type: "text", placeholder: "Asia/Kathmandu", help: "Server timezone" },
  ]},
] as const;

type FieldKey = keyof SettingsData;

export default function SettingsPage() {
  const [values, setValues] = useState<SettingsData>({});
  const [original, setOriginal] = useState<SettingsData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});
  const [envPath, setEnvPath] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await getSettings();
      setValues(res.settings); setOriginal(res.settings); setEnvPath(res.env_path); setError(null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isDirty = JSON.stringify(values) !== JSON.stringify(original);

  const handleSave = async () => {
    setSaving(true); setError(null); setNote(null);
    try {
      const changed: SettingsData = {};
      for (const [k, v] of Object.entries(values) as [FieldKey, string][]) {
        if (v !== original[k] && v.trim()) (changed as Record<string, string>)[k] = v;
      }
      if (!Object.keys(changed).length) { setNote("No changes to save."); return; }
      const res = await saveSettings(changed);
      setSaved(true); setNote(res.note); setOriginal({...values});
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-6 max-w-3xl mx-auto animate-pulse space-y-4"><div className="h-8 bg-gray-800 rounded w-1/3" />{[1,2,3].map(i => <div key={i} className="h-48 bg-gray-900 rounded-xl" />)}</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Editing <code className="text-indigo-400 text-xs bg-indigo-600/10 px-1.5 py-0.5 rounded">{envPath || "backend/.env"}</code></p>
        </div>
        <div className="flex gap-2 mt-1">
          {isDirty && <button onClick={() => { setValues({...original}); setNote(null); setError(null); }} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300">Reset</button>}
          <button onClick={handleSave} disabled={saving || !isDirty}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${saved ? "bg-green-600/20 border border-green-600/30 text-green-400" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}>
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm">{error}</div>}
      {note && !error && <div className="mb-4 bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-4 text-yellow-300 text-sm">{note}</div>}

      <div className="space-y-5">
        {GROUPS.map(group => (
          <div key={group.title} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800"><h2 className="text-white font-semibold text-sm">{group.title}</h2></div>
            <div className="divide-y divide-gray-800/50">
              {group.fields.map(field => {
                const key = field.key as FieldKey;
                const val = (values[key] as string) ?? "";
                const isSecret = field.type === "password";
                const changed = val !== ((original[key] as string) ?? "");
                return (
                  <div key={field.key} className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <label className="text-white text-sm font-medium">{field.label}</label>
                      {changed && <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-600/30">modified</span>}
                    </div>
                    {field.type === "select" ? (
                      <select value={val} onChange={e => setValues(p => ({...p, [key]: e.target.value}))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                        {(field as {options: readonly string[]}).options.map(o => <option key={o} value={o} className="bg-gray-800">{o}</option>)}
                      </select>
                    ) : (
                      <div className="relative">
                        <input type={isSecret && !showPwd[field.key] ? "password" : "text"} value={val}
                          onChange={e => setValues(p => ({...p, [key]: e.target.value}))}
                          placeholder={(field as {placeholder?: string}).placeholder}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors pr-10" />
                        {isSecret && <button type="button" onClick={() => setShowPwd(p => ({...p, [field.key]: !p[field.key]}))} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>}
                      </div>
                    )}
                    <p className="text-gray-500 text-xs mt-1.5">{field.help}</p>
                    {"link" in field && (field as {link?: {label: string; url: string}}).link && (
                      <a href={(field as {link: {label: string; url: string}}).link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs mt-1">
                        {(field as {link: {label: string; url: string}}).link.label}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <div><p className="text-blue-300 text-sm font-medium">Restart required for some changes</p><p className="text-blue-400/60 text-xs mt-0.5">After changing API keys or AI mode, restart the backend server.</p></div>
      </div>
    </div>
  );
}
