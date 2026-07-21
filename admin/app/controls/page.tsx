"use client";
import { useCallback, useEffect, useState } from "react";

const API = "/api/backend";
type Character = "spiderman" | "messi" | "nani" | "babu" | "nepali";
type Controls = {
  maintenance_mode: boolean; ai_enabled: boolean; microphone_enabled: boolean;
  calls_enabled: boolean; explore_enabled: boolean; stories_enabled: boolean;
  songs_enabled: boolean; yoga_enabled: boolean; default_language: "english" | "nepali";
  default_character: Character; auto_speak: boolean; admin_notice: string;
  sync_interval_seconds: number;
};
type Document = { revision: number; updated_at: string; controls: Controls };

const switches: { key: keyof Controls; label: string; help: string }[] = [
  { key: "maintenance_mode", label: "Maintenance mode", help: "Shows an admin notice and pauses child AI controls." },
  { key: "ai_enabled", label: "AI conversations", help: "Allow voice questions and AI responses." },
  { key: "microphone_enabled", label: "Microphone", help: "Allow recording from the child app." },
  { key: "calls_enabled", label: "Parent calls", help: "Enable calling in child and parent apps." },
  { key: "explore_enabled", label: "Explore", help: "Enable interactive science scenes." },
  { key: "stories_enabled", label: "Stories", help: "Enable the story library." },
  { key: "songs_enabled", label: "Songs", help: "Enable kids songs." },
  { key: "yoga_enabled", label: "Yoga", help: "Enable yoga activities." },
  { key: "auto_speak", label: "Auto speak", help: "Speak AI answers automatically." },
];

export default function ControlsPage() {
  const [doc, setDoc] = useState<Document | null>(null);
  const [draft, setDraft] = useState<Controls | null>(null);
  const [state, setState] = useState("Loading controls...");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/controls`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next: Document = await res.json();
      setDoc(next); setDraft(next.controls); setState("Synced");
    } catch (error) { setState(`Offline: ${(error as Error).message}`); }
  }, []);

  useEffect(() => { load(); const timer = setInterval(load, 10000); return () => clearInterval(timer); }, [load]);

  const save = async () => {
    if (!draft) return;
    setState("Saving...");
    try {
      const res = await fetch(`${API}/controls`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(await res.text());
      const next: Document = await res.json();
      setDoc(next); setDraft(next.controls); setState("Synced to all apps");
    } catch (error) { setState(`Save failed: ${(error as Error).message}`); }
  };

  if (!draft) return <div className="p-6 text-gray-400">{state}</div>;
  const set = <K extends keyof Controls>(key: K, value: Controls[K]) => setDraft(current => current ? ({ ...current, [key]: value }) : current);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-bold text-white">App Controls</h1>
          <p className="text-gray-400 text-sm mt-1">One control source for child and parent apps.</p></div>
        <button onClick={save} className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">Save & Sync</button>
      </div>
      <div className="mb-5 rounded-xl border border-indigo-700/40 bg-indigo-900/20 px-4 py-3 flex justify-between text-sm">
        <span className="text-indigo-300">{state}</span><span className="text-gray-500">Revision {doc?.revision ?? 0}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {switches.map(item => (
          <button key={item.key} onClick={() => set(item.key, !draft[item.key] as never)}
            className="text-left bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4 hover:border-gray-700">
            <span className={`w-11 h-6 rounded-full p-1 transition-colors ${draft[item.key] ? "bg-indigo-600" : "bg-gray-700"}`}>
              <span className={`block size-4 bg-white rounded-full transition-transform ${draft[item.key] ? "translate-x-5" : ""}`} />
            </span>
            <span><span className="block text-white text-sm font-semibold">{item.label}</span><span className="block text-gray-500 text-xs mt-0.5">{item.help}</span></span>
          </button>
        ))}
      </div>
      <div className="mt-5 bg-gray-900 border border-gray-800 rounded-xl p-5 grid md:grid-cols-2 gap-4">
        <label className="text-sm text-gray-300">Default language
          <select value={draft.default_language} onChange={e => set("default_language", e.target.value as Controls["default_language"])} className="mt-2 w-full bg-gray-800 rounded-lg p-2.5">
            <option value="english">English</option><option value="nepali">Nepali</option>
          </select>
        </label>
        <label className="text-sm text-gray-300">Default character
          <select value={draft.default_character} onChange={e => set("default_character", e.target.value as Character)} className="mt-2 w-full bg-gray-800 rounded-lg p-2.5">
            <option value="spiderman">Spider-Man</option><option value="messi">Messi</option><option value="nani">Nani</option><option value="babu">Babu</option><option value="nepali">Nepali Duo</option>
          </select>
        </label>
        <label className="text-sm text-gray-300 md:col-span-2">Admin notice
          <input value={draft.admin_notice} maxLength={240} onChange={e => set("admin_notice", e.target.value)} placeholder="Message shown in both apps" className="mt-2 w-full bg-gray-800 rounded-lg p-2.5" />
        </label>
        <label className="text-sm text-gray-300">Sync interval (seconds)
          <input type="number" min={3} max={300} value={draft.sync_interval_seconds} onChange={e => set("sync_interval_seconds", Number(e.target.value))} className="mt-2 w-full bg-gray-800 rounded-lg p-2.5" />
        </label>
      </div>
    </div>
  );
}
